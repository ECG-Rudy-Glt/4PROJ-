import { AppError } from '../middlewares/errorHandler';

export const VAULT_SHARE_FORBIDDEN_MESSAGE =
  'Les éléments du coffre-fort ne peuvent pas être partagés. Déplacez-les hors du coffre-fort pour les partager.';

export const VAULT_SHARE_FORBIDDEN_CODE = 'VAULT_SHARE_FORBIDDEN';

export function vaultShareForbiddenError() {
  return new AppError(403, VAULT_SHARE_FORBIDDEN_MESSAGE, VAULT_SHARE_FORBIDDEN_CODE);
}
