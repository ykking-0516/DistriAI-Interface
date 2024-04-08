import {
  utils,
  web3,
  Program,
  BN,
  AnchorProvider,
  setProvider,
} from "@project-serum/anchor";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import idl from "../services/idl.json";
import webconfig from "../webconfig";
import { formatBalance } from ".";

const { PROGRAM, MINT_PROGRAM } = webconfig;

export default function useSolanaMethod() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = new AnchorProvider(connection, wallet, {});
  setProvider(provider);
  const program = new Program(idl, PROGRAM);

  const [vault] = web3.PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("vault"), MINT_PROGRAM.toBytes()],
    PROGRAM
  );
  const systemProgram = new PublicKey("11111111111111111111111111111111");

  // Seller's Device Make Offer
  const makeOffer = async (machineInfo) => {
    let { uuid, price, duration, disk } = machineInfo;
    price = parseFloat(price) * LAMPORTS_PER_SOL;
    price = new BN(price);
    duration = new BN(duration);
    disk = new BN(disk);
    try {
      const transaction = await program.methods
        .makeOffer(price, duration, disk)
        .accounts({
          machine: getMachinePublicKey(uuid),
          owner: wallet.publicKey,
        })
        .rpc();
      const res = await checkConfirmation(transaction);
      return res;
    } catch (error) {
      throw error;
    }
  };

  // Unlist Device From Market
  const cancelOffer = async (uuid) => {
    try {
      const transaction = await program.methods
        .cancelOffer()
        .accounts({
          machine: getMachinePublicKey(uuid),
          owner: wallet.publicKey,
        })
        .rpc();
      const res = await checkConfirmation(transaction);
      return res;
    } catch (error) {
      throw error;
    }
  };

  // Rent Device On Market
  const placeOrder = async (machinePublicKey, duration, metadata) => {
    duration = new BN(duration);
    metadata = JSON.stringify(metadata);
    const orderUuid = utils.bytes.utf8.encode(new Date().valueOf().toString());
    const orderArray = new Uint8Array(16);
    orderArray.set(orderUuid);
    const [orderPublicKey] = web3.PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode("order"),
        wallet.publicKey.toBytes(),
        orderArray,
      ],
      PROGRAM
    );
    try {
      const transaction = await program.methods
        .placeOrder(orderUuid, duration, metadata)
        .accounts({
          machine: machinePublicKey,
          order: orderPublicKey,
          buyer: wallet.publicKey,
          buyerAta: findAssociatedTokenAddress(wallet.publicKey),
          vault,
          mint: MINT_PROGRAM,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      const res = await checkConfirmation(transaction);
      return res;
    } catch (error) {
      throw error;
    }
  };

  // Extend Renting Duration
  const renewOrder = async (machinePublicKey, orderUuid, duration) => {
    duration = new BN(duration);
    const [orderPublicKey] = web3.PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode("order"),
        wallet.publicKey.toBytes(),
        utils.bytes.hex.decode(orderUuid),
      ],
      PROGRAM
    );
    try {
      const transaction = await program.methods
        .renewOrder(duration)
        .accounts({
          machine: machinePublicKey,
          order: orderPublicKey,
          buyer: wallet.publicKey,
          buyerAta: findAssociatedTokenAddress(wallet.publicKey),
          vault,
          mint: MINT_PROGRAM,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      const res = await checkConfirmation(transaction);
      return res;
    } catch (error) {
      throw error;
    }
  };

  // Refund Order
  const refundOrder = async (machinePublicKey, orderUuid, sellerPublicKey) => {
    const [orderPublicKey] = web3.PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode("order"),
        wallet.publicKey.toBytes(),
        utils.bytes.hex.decode(orderUuid),
      ],
      PROGRAM
    );
    try {
      const transaction = await program.methods
        .refundOrder()
        .accounts({
          machine: machinePublicKey,
          order: orderPublicKey,
          buyer: wallet.publicKey,
          buyerAta: findAssociatedTokenAddress(wallet.publicKey),
          sellerAta: findAssociatedTokenAddress(sellerPublicKey),
          vault,
          mint: MINT_PROGRAM,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram,
        })
        .rpc();
      const res = await checkConfirmation(transaction);
      return res;
    } catch (error) {
      throw error;
    }
  };

  // Claim Available Periodic Rewards
  const claimButchRewards = async (rewards) => {
    const transactions = [];
    try {
      const blockhash = (await connection.getLatestBlockhash("finalized"))
        .blockhash;
      for (const reward of rewards) {
        const transaction = new Transaction();
        const instruction = await claimReward(
          reward.MachineId,
          wallet.publicKey,
          reward.Period
        );
        transaction.add(instruction);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        transactions.push(transaction);
      }
      const signedTransactions = await wallet.signAllTransactions(transactions);
      const sentTransactions = [];
      for await (const transaction of signedTransactions) {
        const confirmTransaction = await connection.sendRawTransaction(
          transaction.serialize()
        );
        sentTransactions.push(confirmTransaction);
      }
      return sentTransactions;
    } catch (error) {
      throw error;
    }
  };

  const claimReward = async (machineUuid, ownerPublicKey, period) => {
    const [rewardPublicKey] = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode("reward"), new BN(period).toArray("le", 4)],
      PROGRAM
    );
    const [rewardMachinePublicKey] = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode("reward-machine"),
        new BN(period).toArray("le", 4),
        ownerPublicKey.toBytes(),
        utils.bytes.hex.decode(machineUuid),
      ],
      PROGRAM
    );
    const [rewardPool] = web3.PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode("reward-pool"), MINT_PROGRAM.toBytes()],
      PROGRAM
    );
    try {
      const instruction = await program.methods
        .claim(period)
        .accounts({
          machine: getMachinePublicKey(machineUuid),
          reward: rewardPublicKey,
          rewardMachine: rewardMachinePublicKey,
          owner: ownerPublicKey,
          ownerAta: findAssociatedTokenAddress(ownerPublicKey),
          rewardPool,
          mint: MINT_PROGRAM,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram,
        })
        .instruction();
      return instruction;
    } catch (error) {
      throw error;
    }
  };

  // Check Transaction Confirmation On Solana
  const checkConfirmation = async (transaction) => {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const latestBlockHash = await connection.getLatestBlockhash();
          const confirmation = await connection.confirmTransaction(
            {
              blockhash: latestBlockHash,
              lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
              signature: transaction,
            },
            "finalized"
          );
          resolve(confirmation);
        } catch (error) {
          reject(error);
        }
      }, 3000);
    });
  };

  // Get User's Associated-Token-Address
  const findAssociatedTokenAddress = (publicKey) => {
    const [associatedTokenAddress] = PublicKey.findProgramAddressSync(
      [
        publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        MINT_PROGRAM.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return associatedTokenAddress;
  };

  // Get Machine's PublicKey
  const getMachinePublicKey = (uuid, owner) => {
    const [machinePublicKey] = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode("machine"),
        (owner ?? wallet.publicKey).toBytes(),
        utils.bytes.hex.decode(uuid),
      ],
      PROGRAM
    );
    return machinePublicKey;
  };

  // Get User's DIST Balance
  const getTokenBalance = async (publicKey) => {
    const tokenAccount = findAssociatedTokenAddress(publicKey);
    try {
      const token = await connection.getTokenAccountBalance(tokenAccount);
      return formatBalance(token.value.amount);
    } catch (error) {
      throw error;
    }
  };

  const methods = {
    makeOffer,
    cancelOffer,
    placeOrder,
    renewOrder,
    refundOrder,
    claimButchRewards,
    getTokenBalance,
    getMachinePublicKey,
  };

  return { wallet, methods };
}