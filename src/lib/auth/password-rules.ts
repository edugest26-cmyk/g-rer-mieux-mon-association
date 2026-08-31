/**
 * Règles de robustesse des mots de passe.
 *
 * Volontairement séparées de `password.ts` : ce dernier importe bcrypt et est
 * marqué `server-only`, alors que ces règles doivent aussi être lisibles par
 * le formulaire d'inscription, côté navigateur.
 *
 * La longueur protège bien mieux qu'une combinaison imposée de caractères
 * spéciaux, qui pousse surtout à des variantes prévisibles.
 */

export const PASSWORD_MIN_LENGTH = 10

export function checkPasswordStrength(plain: string): string | null {
  if (plain.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`
  }
  if (!/[a-zA-Z]/.test(plain) || !/[0-9]/.test(plain)) {
    return 'Le mot de passe doit mêler lettres et chiffres.'
  }
  return null
}
