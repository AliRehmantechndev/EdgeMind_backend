import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../../lib/prisma';
import { generateToken, hashPassword, comparePassword } from '../../utils/auth';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Validation middleware
const validateSignup = [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Name cannot be empty'),

];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Sign Up
router.post('/signup', validateSignup, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || 'User',
        
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      }
    });

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'User created successfully',
      user,
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', validateLogin, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user.id);

    // Return user data without password
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };

    res.json({
      message: 'Login successful',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User profile retrieved successfully',
      user
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
