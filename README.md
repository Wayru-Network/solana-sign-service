# Solana Sign Service

A robust Node.js microservice for handling Solana blockchain transaction signing and management. This service provides secure endpoints for various Solana operations including reward claims, token staking, NFT node initialization, and more.

## Features

* 🔐 **Secure Transaction Signing**: JWT-based authentication for secure API access
* 🎯 **Multiple Solana Operations**: Support for rewards, staking, deposits, withdrawals, and NFT node management
* ⚡ **Real-time Updates**: Socket.io integration for real-time transaction status updates
* 🛡️ **Rate Limiting**: Built-in rate limiting to prevent abuse
* 🔄 **Transaction Tracking**: Comprehensive transaction status tracking and validation
* 🐳 **Docker Support**: Containerized deployment with Docker
* ☸️ **Kubernetes Ready**: Kubernetes configuration files included
* 📊 **Database Integration**: PostgreSQL for persistent data storage
* 🔍 **Transaction Simulation**: Pre-flight transaction simulation support

## Tech Stack

* **Runtime**: Node.js 18+
* **Framework**: Koa.js
* **Language**: TypeScript
* **Database**: PostgreSQL
* **Blockchain**: Solana (Web3.js, Anchor)
* **Authentication**: JWT (JSON Web Tokens)
* **Real-time**: Socket.io
* **Validation**: Yup
* **Containerization**: Docker

## Prerequisites

Before you begin, ensure you have the following installed:

* Node.js 18+ and npm
* PostgreSQL database
* Solana CLI (optional, for local development)
* Docker (optional, for containerized deployment)

## Installation

1. **Clone the repository**
   

```bash
   git clone <repository-url>
   cd solana-sign-service
   ```

2. **Install dependencies**
   

```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with the following variables:
   

```env
   # Server Configuration
   PORT=1338
   NODE_ENV=development

   # Database Configuration
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_NAME=your_database_name
   DATABASE_USERNAME=your_database_user
   DATABASE_PASSWORD=your_database_password
   DATABASE_SSL=false

   # Authentication
   JWT_SECRET=your_jwt_secret_key
   DB_ADMIN_PUBLIC_KEY=your_admin_public_key
   NOT_VALIDATE_AUTH=false

   # Solana Configuration
   SOLANA_API_KEY=your_solana_api_key
   SOLANA_API_URL=https://api.mainnet-beta.solana.com
   ADMIN_REWARD_SYSTEM_PRIVATE_KEY=["your","private","key","array"]
   DEFAULT_REWARD_TOKEN_MINT=CyVfcAhqHoY28roieSxAx9B4RCcGEDnVrxbwoc3oH7wa
   DEFAULT_REWARD_SYSTEM_PROGRAM_ID=DGkrN8CiTvRSZbqa7rZjKJ5SHEmMm9Q7JMDjKubidhtV
   DEFAULT_AIRDROPS_PROGRAM_ID=5KK2ThgEp1AZM8bo79ijJcumSqz9B48bszyhYhuw3K7o
   DEFAULT_STAKE_SYSTEM_PROGRAM_ID=44op5JkWQ4KjXNphN5jWxFssvz6iAXYKJZnVZgPLXUXq
   DEFAULT_WAYRU_FEE_TRANSACTION=10

   # Feature Flags
   DISABLED_SIMULATION_CACHE=false
   SOCKETS_SALT=your_sockets_salt
   ```

4. **Build the project**
   

```bash
   npm run build
   ```

5. **Start the server**
   

```bash
   npm start
   ```

   For development with auto-reload:
   

```bash
   npm run dev
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `1338` |
| `NODE_ENV` | Environment (development/production) | `develop` |
| `DATABASE_HOST` | PostgreSQL host | `localhost` |
| `DATABASE_PORT` | PostgreSQL port | `5432` |
| `DATABASE_NAME` | Database name | - |
| `DATABASE_USERNAME` | Database username | - |
| `DATABASE_PASSWORD` | Database password | - |
| `DATABASE_SSL` | Enable SSL for database | `false` |
| `JWT_SECRET` | Secret key for JWT tokens | - |
| `SOLANA_API_KEY` | Solana RPC API key | - |
| `SOLANA_API_URL` | Solana RPC endpoint | - |
| `ADMIN_REWARD_SYSTEM_PRIVATE_KEY` | Admin private key (JSON array) | - |

## API Endpoints

All endpoints are prefixed with `/api/request-transaction` .

### Authentication

Most endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

### Available Endpoints

#### Rewards

* `POST /to-claim-rewards` - Claim rewards (v1)
* `POST /to-claim-rewards-v2` - Claim rewards with network fee (v2)
* `POST /to-claim-depin-staker-rewards` - Claim DePIN staker rewards (public)

#### NFT Node Operations

* `POST /to-initialize-nfnode` - Initialize NFT node (v1)
* `POST /to-initialize-nfnode-v2` - Initialize NFT node with network fee (v2)
* `POST /to-add-host-to-nfnode` - Add host to NFT node (v1)
* `POST /to-add-host-to-nfnode-v2` - Add host to NFT node (v2)
* `POST /to-update-reward-contract` - Update reward contract

#### Staking Operations

* `POST /to-initialize-stake` - Initialize stake entry (v1)
* `POST /to-initialize-stake-v2` - Initialize stake entry with network fee (v2)
* `POST /to-stake-tokens` - Stake tokens (v1)
* `POST /to-stake-tokens-v2` - Stake tokens with network fee (v2)
* `POST /to-withdraw-staked-tokens` - Withdraw staked tokens (v1)
* `POST /to-withdraw-staked-tokens-v2` - Withdraw staked tokens with network fee (v2)

#### Token Operations

* `POST /to-deposit-tokens` - Deposit tokens (v1)
* `POST /to-deposit-tokens-v2` - Deposit tokens with network fee (v2)
* `POST /to-withdraw-tokens` - Withdraw tokens (v1)
* `POST /to-withdraw-tokens-v2` - Withdraw tokens with network fee (v2)
* `POST /to-claim-w-credits` - Claim W credits

#### Transaction Verification

* `POST /verify-transaction-hash` - Verify transaction hash (public)

### Request Format

All endpoints expect a JSON body with a `signature` field containing a signed message:

```json
{
  "signature": "base64_encoded_signature"
}
```

### Response Format

Success response:

```json
{
  "serializedTx": "base64_encoded_transaction",
  "error": false,
  "code": "SUCCESS_CODE"
}
```

Error response:

```json
{
  "serializedTx": null,
  "error": true,
  "code": "ERROR_CODE"
}
```

## Docker Deployment

### Build Docker Image

```bash
docker build -t solana-sign-service .
```

### Run Container

```bash
docker run -p 3000:80 --env-file .env solana-sign-service
```

### Docker Compose (Example)

```yaml
version: '3.8'
services:
  solana-sign-service:
    build: .
    ports:
      - "3000:80"
    env_file:
      - .env
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: your_database_name
      POSTGRES_USER: your_database_user
      POSTGRES_PASSWORD: your_database_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Kubernetes Deployment

Kubernetes configuration files are available in the `kubernetes/` directory. Update the configuration files with your specific values before deploying.

## Development

### Project Structure

```
solana-sign-service/
├── src/
│   ├── config/          # Configuration files
│   ├── constants/       # Application constants
│   ├── controllers/     # Request handlers
│   ├── errors/          # Error definitions
│   ├── helpers/         # Utility functions
│   ├── interfaces/      # TypeScript interfaces
│   ├── middlewares/     # Express/Koa middlewares
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── validations/     # Input validation schemas
│   └── server.ts        # Application entry point
├── dist/                # Compiled JavaScript
├── kubernetes/          # Kubernetes manifests
├── Dockerfile           # Docker configuration
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

### Scripts

* `npm run dev` - Start development server with auto-reload
* `npm run build` - Compile TypeScript to JavaScript
* `npm start` - Start production server

### Code Style

The project uses TypeScript with strict mode enabled. Follow these guidelines:

* Use TypeScript for all new code
* Follow the existing code structure and patterns
* Add proper type definitions for all functions and variables
* Use async/await for asynchronous operations
* Handle errors appropriately

## Security Considerations

* **Private Keys**: Never commit private keys to the repository. Use environment variables.
* **JWT Secrets**: Use strong, randomly generated secrets for JWT tokens.
* **Database**: Use SSL connections in production.
* **Rate Limiting**: Configure appropriate rate limits for your use case.
* **CORS**: Configure CORS origins appropriately for production.

## Error Handling

The service uses a comprehensive error code system. Common error codes include:

* `REQUEST_TRANSACTION_SUCCESS_CODE` - Operation successful
* `REQUEST_INITIALIZE_NFNODE_INVALID_SIGNATURE_ERROR_CODE` - Invalid signature
* `REQUEST_CLAIM_REWARD_INVALID_DATA_ERROR_CODE` - Invalid request data
* `REQUEST_TRANSACTION_ERROR_CODE` - General transaction error

Refer to the `src/errors/` directory for complete error code definitions.

## Testing

Before deploying to production, ensure you:

1. Test all endpoints with valid and invalid inputs
2. Verify JWT authentication works correctly
3. Test rate limiting functionality
4. Verify database connections and error handling
5. Test Socket.io real-time updates

## Contributing

This project is now open source. Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

**Important**: This project is now open source and maintained by the community. WAYRU no longer exists and will not provide support for this repository. For issues, questions, or contributions, please use the GitHub Issues section.

---

## 💙 Farewell Message

With gratitude and love, we say goodbye.

WAYRU is closing its doors, but we are leaving these repositories open and free for the community.

May they continue to inspire builders, dreamers, and innovators.

With love, WAYRU

---

**Note**: This project is **open source**. Wayru, Inc and The Wayru Foundation are no longer operating entities, and will not provide any kind of support. The community is welcome to use, modify, and improve this codebase.
