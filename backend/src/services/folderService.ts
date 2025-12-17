import prisma from '../config/database';

export class FolderService {
  static async createFolder(userId: string, name: string, parentId?: string) {
    // Check if folder with same name exists in parent
    const existing = await prisma.folder.findFirst({
      where: {
        userId,
        name,
        parentId: parentId || null,
      },
    });

    if (existing) {
      throw new Error('Folder with this name already exists');
    }

    // Build path
    let path = `/${name}`;
    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: {
          id: parentId,
          userId,
        },
      });

      if (!parent) {
        throw new Error('Parent folder not found');
      }

      path = `${parent.path}/${name}`;
    }

    return await prisma.folder.create({
      data: {
        name,
        userId,
        parentId: parentId || null,
        path,
      },
      include: {
        parent: true,
      },
    });
  }

  static async getFolder(folderId: string, userId: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    return folder;
  }

  static async listFolders(userId: string, parentId?: string) {
    return await prisma.folder.findMany({
      where: {
        userId,
        parentId: parentId || null,
      },
      include: {
        children: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  static async updateFolder(folderId: string, userId: string, name: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Check for duplicate name in same parent
    const existing = await prisma.folder.findFirst({
      where: {
        userId,
        name,
        parentId: folder.parentId,
        id: { not: folderId },
      },
    });

    if (existing) {
      throw new Error('Folder with this name already exists');
    }

    // Update path
    let newPath = `/${name}`;
    if (folder.parentId) {
      const parent = await prisma.folder.findUnique({
        where: { id: folder.parentId },
      });
      if (parent) {
        newPath = `${parent.path}/${name}`;
      }
    }

    return await prisma.folder.update({
      where: { id: folderId },
      data: {
        name,
        path: newPath,
      },
    });
  }

  static async moveFolder(folderId: string, userId: string, targetParentId?: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Prevent moving folder into itself or its children
    if (targetParentId) {
      if (targetParentId === folderId) {
        throw new Error('Cannot move folder into itself');
      }

      const targetParent = await prisma.folder.findFirst({
        where: {
          id: targetParentId,
          userId,
        },
      });

      if (!targetParent) {
        throw new Error('Target parent folder not found');
      }

      // Check if target is a child of the folder being moved
      if (targetParent.path.startsWith(folder.path)) {
        throw new Error('Cannot move folder into its own child');
      }
    }

    // Check for duplicate name in target parent
    const existing = await prisma.folder.findFirst({
      where: {
        userId,
        name: folder.name,
        parentId: targetParentId || null,
        id: { not: folderId },
      },
    });

    if (existing) {
      throw new Error('Folder with this name already exists in target location');
    }

    // Update path
    let newPath = `/${folder.name}`;
    if (targetParentId) {
      const parent = await prisma.folder.findUnique({
        where: { id: targetParentId },
      });
      if (parent) {
        newPath = `${parent.path}/${folder.name}`;
      }
    }

    return await prisma.folder.update({
      where: { id: folderId },
      data: {
        parentId: targetParentId || null,
        path: newPath,
      },
    });
  }

  static async deleteFolder(folderId: string, userId: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    // This will cascade delete all children folders and files
    await prisma.folder.delete({
      where: { id: folderId },
    });

    return { message: 'Folder deleted successfully' };
  }

  static async getFolderBreadcrumbs(folderId: string, userId: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }

    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let currentFolder = folder;

    while (currentFolder) {
      breadcrumbs.unshift({
        id: currentFolder.id,
        name: currentFolder.name,
      });

      if (currentFolder.parentId) {
        const parent = await prisma.folder.findUnique({
          where: { id: currentFolder.parentId },
        });
        currentFolder = parent as any;
      } else {
        break;
      }
    }

    return breadcrumbs;
  }
}
