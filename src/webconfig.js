import { PublicKey } from "@solana/web3.js";

const webconfig = {
  apiUrl: process.env.REACT_APP_API_URL,
  PROGRAM: new PublicKey(process.env.REACT_APP_PROGRAM),
  MINT_PROGRAM: new PublicKey("896KfVVY6VRGQs1d9CKLnKUEgXXCCJcEEg7LwSK84vWE"),
};
export default webconfig;
