// Logic split into focused services — this file is a backwards-compatible facade
export { FileUploadService } from './fileUploadService';
export { FileQueryService } from './fileQueryService';
export { FileActionService } from './fileActionService';

import { FileUploadService } from './fileUploadService';
import { FileQueryService } from './fileQueryService';
import { FileActionService } from './fileActionService';

export class FileService {
  static createFiles = FileUploadService.createFiles.bind(FileUploadService);
  static createFile = FileUploadService.createFile.bind(FileUploadService);
  static replaceFileContent = FileUploadService.replaceFileContent.bind(FileUploadService);

  static getFile = FileQueryService.getFile.bind(FileQueryService);
  static listFiles = FileQueryService.listFiles.bind(FileQueryService);
  static searchFiles = FileQueryService.searchFiles.bind(FileQueryService);
  static getRecentFiles = FileQueryService.getRecentFiles.bind(FileQueryService);
  static getDeletedFiles = FileQueryService.getDeletedFiles.bind(FileQueryService);
  static getFavoriteFiles = FileQueryService.getFavoriteFiles.bind(FileQueryService);
  static getAcceptedShares = FileQueryService.getAcceptedShares.bind(FileQueryService);

  static updateFile = FileActionService.updateFile.bind(FileActionService);
  static moveFile = FileActionService.moveFile.bind(FileActionService);
  static deleteFile = FileActionService.deleteFile.bind(FileActionService);
  static restoreFile = FileActionService.restoreFile.bind(FileActionService);
  static toggleFavorite = FileActionService.toggleFavorite.bind(FileActionService);
  static incrementViewCount = FileActionService.incrementViewCount.bind(FileActionService);
  static incrementDownloadCount = FileActionService.incrementDownloadCount.bind(FileActionService);
}
