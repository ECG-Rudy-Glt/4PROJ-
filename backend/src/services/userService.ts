import prisma from '../config/database';

export class UserService {
  /**
   * Rechercher des utilisateurs par email (autocomplete)
   */
  static async searchUsersByEmail(query: string, limit: number = 10) {
    if (!query || query.length < 2) {
      return [];
    }

    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
      take: limit,
      orderBy: {
        email: 'asc',
      },
    });

    return users;
  }

  /**
   * Obtenir les informations basiques d'un utilisateur
   */
  static async getUserBasicInfo(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}
