# Decentralized Insurance DApp 🛡️

A full-stack Web3 application that allows users to purchase decentralized insurance policies and report claims, and allows administrators to manage policies and approve or reject claims.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v16 or higher recommended)
- [MetaMask](https://metamask.io/) extension installed in your web browser.

## Project Structure

The repository is divided into two main parts:
- `/smart-contracts`: Contains the Solidity code for the insurance logic, deployed using Hardhat.
- `/frontend`: Contains the React + Vite web application that interacts with the smart contract.

---

## 🛠️ Installation & Running Locally

### 1. Start the Local Blockchain

Open your terminal, navigate to the `smart-contracts` folder, install dependencies, and start the local Hardhat node:

```bash
cd smart-contracts
npm install
npm run node
```
*Keep this terminal window open. Hardhat will print a list of 20 **test accounts** with 10,000 fake ETH each, along with their private keys.*

### 2. Deploy the Smart Contract

Open a **second terminal window**, navigate to `smart-contracts`, and run the deployment script:

```bash
cd smart-contracts
npx hardhat compile
npm run deploy:localhost
```
The deployment script writes the active contract address and ABI to `frontend/src/contracts/deployments.json`.
Do not edit contract addresses in React files manually; redeploy the contract instead.

### 2a. Deploy to Sepolia (Testnet)

To deploy the smart contract to the Sepolia testnet instead of the local node, use the Sepolia deployment script:

```bash
cd smart-contracts
npx hardhat compile
npm run deploy:sepolia
```
*Note: Make sure your `.env` file in the `smart-contracts` folder is properly configured with your `API_URL` and `PRIVATE_KEY` for Sepolia, and that the account has enough Sepolia ETH for gas.*

## Data and Contract Architecture

- The blockchain contract remains the source of truth for policies, ownership, claims and admin permissions.
- The frontend does not use a database and does not persist application data in local JSON files.
- `frontend/src/contracts/deployments.json` is only a generated deployment manifest: it stores ABI and address per chain so the frontend can connect to the right contract.
- The contract exposes aggregate read methods (`getPolicies`, `getClaims`, `getUserPolicyIds`, `getUserClaims`) so the UI does not need many sequential reads or a file-based cache.
- Claim payout uses a guarded `call` flow instead of `transfer`, with validation for invalid IDs, zero addresses and empty/oversized text fields.

### 3. Start the Frontend Application

In the same (second) terminal, navigate to the `frontend` folder, install dependencies, and start the Vite development server:

```bash
cd ../frontend
npm install
npm run dev
```
*Your application should now be running at `http://localhost:5173/`.*

### 3a. Deploy Frontend to GitHub Pages

To host your frontend application online using GitHub Pages:

1. Ensure you have deployed the smart contract to Sepolia and have the latest `deployments.json`.
2. Open your terminal in the `frontend` folder.
3. Run the deployment script:
   ```bash
   cd frontend
   npm run deploy
   ```
*This command will automatically build the frontend app and push it to the `gh-pages` branch. Your app will soon be available at `https://<your-username>.github.io/<repository-name>/`.*

---

## 🦊 Setting up MetaMask for Local Testing

To interact with the app, you need to configure MetaMask to use your local Hardhat node and import the test accounts.

1. **Add Local Network:**
   - Open MetaMask, click the Network dropdown at the top left.
   - Click **Add network** -> **Add a network manually**.
   - **Network name:** Hardhat Localhost
   - **New RPC URL:** `http://127.0.0.1:8545/`
   - **Chain ID:** `31337`
   - **Currency symbol:** ETH
   - Save and switch to this network.

2. **Import Test Accounts:**
   - In MetaMask, click your account avatar and select **Import account**.
   - Copy the **Private Key** of `Account #0` from the terminal where `npx hardhat node` is running and paste it into MetaMask.
   - Do the same for `Account #1` (to act as a regular user).

---

## 🧪 How to Test the App

### Step 1: Admin Configuration (Account #0)
1. Switch to **Account #0** in MetaMask and connect it to the app. (Account #0 is the admin by default because it deployed the contract).
2. You should see the gold **Admin Panel**.
3. **Fund the Contract:** Click the **"Zasil Kontrakt (10 ETH)"** button and confirm the transaction. The contract needs money to pay out claims later!
4. **Create a Policy:** Fill out the "Utwórz nową polisę" form (e.g. Name: "Car Insurance", Premium: 0.1, Payout: 1.0) and submit it.
5. You can also edit existing policies or add other admin addresses.

### Step 2: User Experience (Account #1)
1. Open the MetaMask extension and switch to **Account #1**. The app will detect the change and hide the Admin Panel.
2. In the **"Dostępne Polisy (Sklep)"** section, find the policy you just created and click **"Kup polisę"**. Confirm the transaction in MetaMask.
3. The policy will immediately move to the **"Twoje Polisy"** table at the top.
4. **Report a Claim:** In the "Twoje Polisy" table, type a description (e.g., "Car crash on main street") and click **"Zgłoś szkodę"**. It will appear in the "Twoje Zgłoszone Szkody" table as "Oczekujące" (Pending).

### Step 3: Resolving the Claim (Account #0)
1. Switch back to **Account #0** in MetaMask.
2. Look at the **"Zarządzanie Roszczeniami"** section in the Admin Panel.
3. You will see the pending claim. You can optionally type a return message (e.g., "Approved, sending funds").
4. Click **"Zatwierdź Wypłatę"** (Approve). 
5. The smart contract will automatically send the ETH payout to Account #1. You can verify the balances in MetaMask!
