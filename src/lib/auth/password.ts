import 'server-only'

import bcrypt from 'bcryptjs'

export { PASSWORD_MIN_LENGTH, checkPasswordStrength } from './password-rules'

/**
 * Coût du hachage bcrypt. 12 tours représentent ~250 ms sur une machine
 * récente : assez lent pour décourager une attaque hors ligne, assez rapide
 * pour ne pas peser sur une connexion légitime.
 */
const ROUNDS = 12

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
