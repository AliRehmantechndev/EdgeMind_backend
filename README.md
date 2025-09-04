# EdgeMind Backend API

EdgeMind is a machine learning platform backend API built with Node.js, Express, TypeScript, and Prisma. It provides comprehensive functionality for machine learning project management, dataset handling, image annotation, and model training.

## Features

- **Authentication & Authorization**: JWT-based user authentication
- **Project Management**: Create and manage ML projects with different types
- **Dataset Management**: Upload, organize, and manage training datasets
- **Image Annotation**: Comprehensive annotation system with classes and export functionality
- **Model Training**: Training pipeline integration and management
- **File Upload**: Secure file upload system for datasets and images

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Validation**: Express Validator
- **Container**: Docker support

## Prerequisites

- Node.js 20 or higher
- PostgreSQL database
- npm or yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AliRehmantechndev/EdgeMind_backend.git
   cd EdgeMind_backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/edgemind"
   JWT_SECRET="your-jwt-secret-key"
   PORT=5000
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   ```

## Usage

### Development
```bash
npm run dev
```
The server will start on `http://localhost:5000` with hot reloading enabled.

### Production
```bash
# Build the project
npm run build

# Start the production server
npm start
```

### Database Commands
```bash
# Open Prisma Studio (Database GUI)
npm run db:studio

# Generate Prisma client
npm run db:generate

# Create and apply new migration
npm run db:migrate
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project by ID
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Datasets
- `GET /api/datasets` - Get all datasets
- `POST /api/datasets` - Create new dataset
- `POST /api/datasets/upload` - Upload dataset files
- `GET /api/datasets/:id` - Get dataset by ID
- `PUT /api/datasets/:id` - Update dataset
- `DELETE /api/datasets/:id` - Delete dataset

### Annotations
- `GET /api/annotations` - Get annotations
- `POST /api/annotations` - Create annotation
- `PUT /api/annotations/:id` - Update annotation
- `DELETE /api/annotations/:id` - Delete annotation

### Annotation Classes
- `GET /api/annotation-classes` - Get annotation classes
- `POST /api/annotation-classes` - Create annotation class
- `PUT /api/annotation-classes/:id` - Update annotation class
- `DELETE /api/annotation-classes/:id` - Delete annotation class

### Training
- `GET /api/training` - Get training runs
- `POST /api/training` - Start new training
- `GET /api/training/:id` - Get training run details

### Trained Models
- `GET /api/trained-models` - Get trained models
- `GET /api/trained-models/:id` - Get model details

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key models include:

- **User**: User authentication and profile management
- **Project**: ML project container with settings and metadata
- **Dataset**: Training data organization and management
- **DatasetImage**: Individual images within datasets
- **Annotation**: Image annotations with coordinates and metadata
- **AnnotationClass**: Classification labels and categories
- **TrainingRun**: Model training sessions and configurations
- **TrainedModel**: Completed model artifacts and metadata

## Docker Support

Build and run with Docker:

```bash
# Build the Docker image
docker build -t edgemind-backend .

# Run the container
docker run -p 5000:5000 --env-file .env edgemind-backend
```

## File Structure

```
src/
├── index.ts              # Application entry point
├── api/
│   ├── middleware/       # Authentication and other middleware
│   └── routes/          # API route handlers
├── lib/
│   └── prisma.ts        # Prisma client configuration
└── utils/               # Utility functions
    ├── auth.ts          # Authentication utilities
    ├── fileUpload.ts    # File upload handling
    └── serializer.ts    # Data serialization
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret key for JWT token signing | Yes |
| `PORT` | Server port (default: 5000) | No |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Guidelines

- Use TypeScript for all new code
- Follow the existing code structure and patterns
- Run `npm run build` to check for TypeScript errors
- Ensure database migrations are included for schema changes
- Test all API endpoints before submitting PRs


## Support

For support and questions, please open an issue on the GitHub repository.

---

**EdgeMind Backend** - Empowering machine learning workflows with robust API infrastructure.
