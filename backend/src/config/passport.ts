import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import prisma from './database';
import { JWTPayload, OAuth2Profile } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// JWT Strategy
const jwtOptions: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET,
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload: JWTPayload, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (user) {
        // Validation du token version (Logout global)
        const tokenVersion = payload.tokenVersion || 1;

        console.log(`[Auth Debug] User ${user.email} | DB Version: ${user.tokenVersion} | Token Version: ${tokenVersion}`);

        if (user.tokenVersion !== tokenVersion) {
          console.log('[Auth Debug] Token rejected due to version mismatch');
          return done(null, false, { message: 'Token invalide (version mismatch)' });
        }
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  })
);

// Google OAuth2 Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.API_URL}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile: OAuth2Profile, done) => {
        try {
          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { providerId: profile.id, provider: 'google' },
                { email: profile.emails?.[0]?.value },
              ],
            },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: profile.emails?.[0]?.value || '',
                provider: 'google',
                providerId: profile.id,
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                avatar: profile.photos?.[0]?.value,
              },
            });
          } else if (!user.providerId) {
            // Link existing account with Google
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                provider: 'google',
                providerId: profile.id,
              },
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );
}

// GitHub OAuth2 Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${process.env.API_URL}/api/auth/github/callback`,
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { providerId: profile.id, provider: 'github' },
                { email: profile.emails?.[0]?.value },
              ],
            },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: profile.emails?.[0]?.value || `${profile.username}@github.com`,
                provider: 'github',
                providerId: profile.id,
                firstName: profile.displayName || profile.username,
                avatar: profile.photos?.[0]?.value,
              },
            });
          } else if (!user.providerId) {
            // Link existing account with GitHub
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                provider: 'github',
                providerId: profile.id,
              },
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error, undefined);
        }
      }
    )
  );
}

export default passport;
