// Logic split into focused services - this file is a backwards-compatible facade
export { SharedLinkService } from './sharedLinkService';
export { SharedFolderService } from './sharedFolderService';
export { SharedFileService } from './sharedFileService';

import { SharedLinkService } from './sharedLinkService';
import { SharedFolderService } from './sharedFolderService';
import { SharedFileService } from './sharedFileService';

export class ShareService {
  static createShareLink = SharedLinkService.createShareLink.bind(SharedLinkService);
  static createBundleShareLink = SharedLinkService.createBundleShareLink.bind(SharedLinkService);
  static getShareLink = SharedLinkService.getShareLink.bind(SharedLinkService);
  static getBundleShareLink = SharedLinkService.getBundleShareLink.bind(SharedLinkService);
  static incrementDownloadCount = SharedLinkService.incrementDownloadCount.bind(SharedLinkService);
  static listUserShareLinks = SharedLinkService.listUserShareLinks.bind(SharedLinkService);
  static deleteShareLink = SharedLinkService.deleteShareLink.bind(SharedLinkService);

  static shareFolder = SharedFolderService.shareFolder.bind(SharedFolderService);
  static listSharedWithMe = SharedFolderService.listSharedWithMe.bind(SharedFolderService);
  static listSharedByMe = SharedFolderService.listSharedByMe.bind(SharedFolderService);
  static updateSharedFolderPermissions = SharedFolderService.updatePermissions.bind(SharedFolderService);
  static removeSharedFolder = SharedFolderService.removeSharedFolder.bind(SharedFolderService);
  static getSharedFolderContents = SharedFolderService.getSharedFolderContents.bind(SharedFolderService);
  static acceptSharedFolder = SharedFolderService.acceptSharedFolder.bind(SharedFolderService);
  static rejectSharedFolder = SharedFolderService.rejectSharedFolder.bind(SharedFolderService);

  static shareFile = SharedFileService.shareFile.bind(SharedFileService);
  static listFilesSharedWithMe = SharedFileService.listFilesSharedWithMe.bind(SharedFileService);
  static listFilesSharedByMe = SharedFileService.listFilesSharedByMe.bind(SharedFileService);
  static getFileShares = SharedFileService.getFileShares.bind(SharedFileService);
  static updateSharedFilePermissions = SharedFileService.updatePermissions.bind(SharedFileService);
  static removeSharedFile = SharedFileService.removeSharedFile.bind(SharedFileService);
  static getSharedFileAccess = SharedFileService.getSharedFileAccess.bind(SharedFileService);
  static acceptSharedFile = SharedFileService.acceptSharedFile.bind(SharedFileService);
  static rejectSharedFile = SharedFileService.rejectSharedFile.bind(SharedFileService);

  static async getPendingShares(userId: string) {
    const [files, folders] = await Promise.all([
      SharedFileService.getPendingFiles(userId),
      SharedFolderService.getPendingFolders(userId),
    ]);
    return { files, folders, total: files.length + folders.length };
  }
}
