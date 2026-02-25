import Stripe from 'stripe';
import { Plan, SubscriptionStatus } from '@prisma/client';
import prisma from '../config/database';
import { PlanService } from './planService';
import { AuditService } from './auditService';

type PaidPlan = 'PRO' | 'BUSINESS' | 'ENTERPRISE';

const PAID_PLANS: PaidPlan[] = ['PRO', 'BUSINESS', 'ENTERPRISE'];

export class BillingService {
  private static stripe: Stripe | null = null;

  private static getStripeClient(): Stripe {
    if (this.stripe) {
      return this.stripe;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('Stripe is not configured: STRIPE_SECRET_KEY is missing');
    }

    this.stripe = new Stripe(secretKey);
    return this.stripe;
  }

  private static getPriceIdForPlan(plan: PaidPlan): string {
    const mapping: Record<PaidPlan, string | undefined> = {
      PRO: process.env.STRIPE_PRICE_PRO_MONTHLY,
      BUSINESS: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
      ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    };

    const priceId = mapping[plan];
    if (!priceId) {
      throw new Error(`Stripe price is not configured for plan ${plan}`);
    }

    return priceId;
  }

  private static getPlanFromPriceId(priceId?: string | null): Plan | null {
    if (!priceId) return null;

    if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return 'PRO';
    if (priceId === process.env.STRIPE_PRICE_BUSINESS_MONTHLY) return 'BUSINESS';
    if (priceId === process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY) return 'ENTERPRISE';
    return null;
  }

  private static mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'incomplete':
        return SubscriptionStatus.INCOMPLETE;
      case 'past_due':
      case 'unpaid':
        return SubscriptionStatus.PAST_DUE;
      case 'incomplete_expired':
      case 'canceled':
      case 'paused':
        return SubscriptionStatus.CANCELED;
      default:
        return SubscriptionStatus.PAST_DUE;
    }
  }

  private static async findUserByCustomerId(customerId: string) {
    return prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });
  }

  private static async ensureStripeCustomer(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const stripe = this.getStripeClient();
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
      metadata: {
        userId: user.id,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  static async createCheckoutSession(userId: string, targetPlan: Plan) {
    if (!PAID_PLANS.includes(targetPlan as PaidPlan)) {
      throw new Error('Checkout is only available for paid plans');
    }

    const stripe = this.getStripeClient();
    const customerId = await this.ensureStripeCustomer(userId);
    const priceId = this.getPriceIdForPlan(targetPlan as PaidPlan);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      client_reference_id: userId,
      success_url: `${frontendUrl}/plans?checkout=success`,
      cancel_url: `${frontendUrl}/plans?checkout=cancel`,
      metadata: {
        userId,
        targetPlan,
      },
      subscription_data: {
        metadata: {
          userId,
          targetPlan,
        },
      },
    });

    return {
      id: session.id,
      url: session.url,
    };
  }

  static async createBillingPortalSession(userId: string) {
    const stripe = this.getStripeClient();
    const customerId = await this.ensureStripeCustomer(userId);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendUrl}/plans`,
    });

    return {
      url: session.url,
    };
  }

  static constructWebhookEvent(rawPayload: Buffer | string, signature?: string): Stripe.Event {
    const stripe = this.getStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret) {
      if (!signature) {
        throw new Error('Missing Stripe signature');
      }
      return stripe.webhooks.constructEvent(rawPayload, signature, webhookSecret);
    }

    const jsonPayload =
      typeof rawPayload === 'string' ? rawPayload : rawPayload.toString('utf8');
    return JSON.parse(jsonPayload) as Stripe.Event;
  }

  private static async applyPlanAndStatusByCustomerId(
    customerId: string,
    params: {
      plan?: Plan;
      status?: SubscriptionStatus;
      fallbackToFreeOnCancel?: boolean;
    }
  ): Promise<void> {
    const user = await this.findUserByCustomerId(customerId);
    if (!user) return;

    const nextStatus = params.status || user.subscriptionStatus;
    let nextPlan = params.plan || user.plan;

    if (params.fallbackToFreeOnCancel && nextStatus === SubscriptionStatus.CANCELED) {
      nextPlan = 'FREE';
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: nextPlan,
        subscriptionStatus: nextStatus,
      },
    });

    await PlanService.syncUserQuotaLimit(user.id);
  }

  private static async handleCheckoutCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== 'subscription') return;

    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (!customerId) return;

    const userId = session.metadata?.userId || session.client_reference_id || undefined;
    const targetPlan = session.metadata?.targetPlan as Plan | undefined;

    const stripe = this.getStripeClient();
    let subscriptionStatus: SubscriptionStatus = SubscriptionStatus.ACTIVE;
    let planFromSubscription: Plan | null = null;

    if (typeof session.subscription === 'string') {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      subscriptionStatus = this.mapStripeSubscriptionStatus(subscription.status);
      planFromSubscription = this.getPlanFromPriceId(
        subscription.items.data[0]?.price?.id || null
      );
    }

    const updateData: any = {
      stripeCustomerId: customerId,
      subscriptionStatus,
    };

    const resolvedPlan =
      planFromSubscription ||
      (targetPlan && targetPlan !== 'FREE' ? targetPlan : undefined);

    if (resolvedPlan) {
      updateData.plan = resolvedPlan;
    }

    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
      await PlanService.syncUserQuotaLimit(userId);
      return;
    }

    const user = await this.findUserByCustomerId(customerId);
    if (!user) return;

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
    await PlanService.syncUserQuotaLimit(user.id);
  }

  private static async handleSubscriptionEvent(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const nextStatus = this.mapStripeSubscriptionStatus(subscription.status);
    const nextPlan = this.getPlanFromPriceId(subscription.items.data[0]?.price?.id || null);

    const fallbackToFreeOnCancel = event.type === 'customer.subscription.deleted';

    await this.applyPlanAndStatusByCustomerId(customerId, {
      plan: nextPlan || undefined,
      status: nextStatus,
      fallbackToFreeOnCancel,
    });
  }

  private static async handleInvoiceEvent(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    if (!customerId) return;

    if (event.type === 'invoice.payment_failed') {
      await this.applyPlanAndStatusByCustomerId(customerId, {
        status: SubscriptionStatus.PAST_DUE,
      });
      return;
    }

    if (event.type === 'invoice.payment_succeeded') {
      await this.applyPlanAndStatusByCustomerId(customerId, {
        status: SubscriptionStatus.ACTIVE,
      });
    }
  }

  static async handleWebhookEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleSubscriptionEvent(event);
        break;
      case 'invoice.payment_failed':
      case 'invoice.payment_succeeded':
        await this.handleInvoiceEvent(event);
        break;
      default:
        break;
    }
  }

  static async downgradeToFree(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'FREE',
        subscriptionStatus: SubscriptionStatus.CANCELED,
      },
    });

    await PlanService.syncUserQuotaLimit(userId);

    await AuditService.createLog(userId, 'PLAN_DOWNGRADE', {
      newPlan: 'FREE',
      source: 'manual',
    });
  }

  static async overridePlanWithoutStripe(adminUserId: string, targetUserId: string, plan: Plan) {
    const nextStatus =
      plan === 'FREE' ? SubscriptionStatus.CANCELED : SubscriptionStatus.ACTIVE;

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        plan,
        subscriptionStatus: nextStatus,
      },
    });

    await PlanService.syncUserQuotaLimit(targetUserId);

    await AuditService.createLog(adminUserId, 'ADMIN_PLAN_CHANGE', {
      targetUserId,
      newPlan: plan,
      source: 'admin_bypass',
    });
  }
}
