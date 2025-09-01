import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../utils/auth';
import prisma from '../../lib/prisma';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const queryToken = req.query.token as string;
  
  const token = headerToken || queryToken;

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    req.user = { userId: user.id, email: user.email };
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};
