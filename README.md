# IoT Dashboard Backend

A professional Node.js backend API for the IoT Dashboard application with real-time email functionality for password reset.

## 🏗️ **Project Structure**

```
iot-dashboard-backend/
├── src/
│   ├── config/
│   │   ├── email.js          # Email configuration with Nodemailer
│   │   └── database.js       # Database configuration
│   ├── controllers/          # Route controllers (future use)
│   ├── middleware/
│   │   ├── errorHandler.js   # Global error handling
│   │   └── notFound.js       # 404 handler
│   ├── models/              # Data models (future use)
│   ├── routes/
│   │   ├── auth.js          # Authentication routes
│   │   └── health.js        # Health check routes
│   ├── services/            # Business logic services (future use)
│   ├── utils/
│   │   └── logger.js        # Winston logging utility
│   └── app.js               # Main application file
├── tests/
│   ├── unit/                # Unit tests
│   └── integration/         # Integration tests
├── logs/                    # Application logs
├── public/
│   └── uploads/             # File uploads
├── scripts/
│   └── setup.js             # Setup script
├── package.json
├── .env                     # Environment variables
└── README.md
```

## 🚀 **Quick Start**

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Edit the `.env` file with your email settings:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
EMAIL_FROM=IoT Dashboard <your-email@gmail.com>
```

### 3. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## 📧 **Email Configuration**

### Gmail Setup (Recommended)
1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this password in your `.env` file as `EMAIL_PASS`

### Other Email Providers
You can use any SMTP provider by updating the email configuration in `.env`:
```env
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your-email@your-provider.com
EMAIL_PASS=your-password
```

## 🔗 **API Endpoints**

### Authentication Routes (`/api/auth`)

#### Request Password Reset
```http
POST /api/auth/request-reset
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset email sent successfully. Please check your inbox.",
  "email": "user@example.com"
}
```

#### Reset Password
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset_token_here",
  "email": "user@example.com",
  "newPassword": "new_password_here"
}
```

#### Validate Reset Token
```http
GET /api/auth/validate-reset-token?token=reset_token_here&email=user@example.com
```

### Health Check Routes (`/api/health`)

#### Basic Health Check
```http
GET /api/health
```

#### Detailed Health Check
```http
GET /api/health/detailed
```

## 🧪 **Testing Email Functionality**

### 1. Test with Frontend
1. Start both frontend and backend servers
2. Go to the forgot password page
3. Enter your email address
4. Check your inbox for the reset email

### 2. Test with API Directly
```bash
# Test password reset request
curl -X POST http://localhost:5000/api/auth/request-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@gmail.com"}'
```

### 3. Check Logs
Monitor the server logs for email sending status:
```bash
tail -f logs/combined.log
```

## 🔧 **Development**

### Available Scripts
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Logging
- **Console**: Colored output for development
- **Files**: `logs/combined.log` and `logs/error.log`
- **Levels**: error, warn, info, debug

### Environment Variables
See `env.example` for all available configuration options.

## 🛡️ **Security Features**

- **Rate Limiting**: Prevents abuse of password reset endpoints
- **Input Validation**: Joi schemas for all inputs
- **CORS Protection**: Configured for specific frontend origins
- **Helmet**: Security headers for protection
- **Token Expiry**: Reset tokens expire after 24 hours
- **One-time Use**: Reset tokens can only be used once

## 🐛 **Troubleshooting**

### Email Not Sending
1. Check your Gmail App Password is correct
2. Verify 2-Factor Authentication is enabled
3. Check the server logs for email configuration errors
4. Ensure your Gmail account allows "less secure apps" if needed

### CORS Issues
1. Verify `FRONTEND_URL` in your `.env` file matches your frontend URL
2. Check that the frontend is making requests to the correct backend URL

### Rate Limiting
- Default: 3 password reset requests per 15 minutes per IP
- Adjust `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS` in `.env` if needed

## 📊 **Monitoring**

### Health Checks
- Basic health: `GET /api/health`
- Detailed health: `GET /api/health/detailed`

### Logs
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Log level can be configured via `LOG_LEVEL` environment variable

## 🚀 **Production Deployment**

1. Set `NODE_ENV=production` in your environment
2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start src/app.js --name "iot-dashboard-backend"
   ```
3. Set up a reverse proxy (nginx) for SSL termination
4. Configure proper logging and monitoring

## 📝 **License**

MIT License - see LICENSE file for details.

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 **Support**

If you encounter any issues:
1. Check the server logs for error messages
2. Verify both servers are running on correct ports
3. Test the API endpoints directly with curl
4. Check browser console for JavaScript errors
5. Verify the `.env` file configuration