import 'dotenv/config';

async function main() {
  const url = process.env.VITE_API_URL || 'http://localhost:5000';
  console.log('Fetching', `${url}/api/warehouses?type=ecommerce`);
  // Since we don't have auth cookies easily in this script, we can't test the protected route without a token
}
