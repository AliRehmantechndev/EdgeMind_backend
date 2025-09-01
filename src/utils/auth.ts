import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET || 'fallback-secret-key';
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
};

export const verifyToken = (token: string): any => {
  const secret = process.env.JWT_SECRET || 'fallback-secret-key';
  return jwt.verify(token, secret);
};

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};
