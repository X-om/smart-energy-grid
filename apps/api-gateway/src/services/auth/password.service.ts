import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';

// * Hash a password
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(env.BCRYPT_ROUNDS);
  return await bcrypt.hash(password, salt);
};

// * Verify a password against a hash
export const verifyPassword = async (password: string, hash: string): Promise<boolean> =>
  await bcrypt.compare(password, hash);

// * Check if password needs rehashing (bcrypt rounds changed)
export const needsRehash = async (hash: string): Promise<boolean> => {
  try {
    const rounds = await bcrypt.getRounds(hash);
    return rounds !== env.BCRYPT_ROUNDS;
  } catch { return true; }
};
