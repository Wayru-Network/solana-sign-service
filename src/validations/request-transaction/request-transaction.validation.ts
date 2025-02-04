import { InitializeNfnodeMessage, NFNodeType } from '@interfaces/request-transaction/request-transaction.interface';
import * as yup from 'yup';

export const signatureInsideSchema = yup.object({
  signature: yup.string()
    .required('The signature is required')
    .trim()
    .strict()
    .typeError('The signature must be a string')
    .test('not-empty', 'The signature cannot be empty',
      value => value?.trim().length > 0
    )
});

export const rewardClaimSchema = yup.object().shape({
  walletAddress: yup.string().required('Wallet address is required'),
  totalAmount: yup.number().required('Total amount is required').positive('Amount must be positive'),
  minerId: yup.number().required('Miner ID is required').positive('Miner ID must be positive'),
  rewardsId: yup.array().of(yup.number()).required('Rewards IDs are required').min(1, 'At least one reward ID is required'),
  type: yup.string().oneOf(['owner', 'host', 'manufacturer'], 'Invalid claimer type').required('Type is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required')
});

export const initializeNfnodeSchema = yup.object().shape({
  walletOwnerAddress: yup.string().required('Wallet owner is required'),
  hostAddress: yup.string().required('Host address is required'),
  manufacturerAddress: yup.string().required('Manufacturer address is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required'),
  nfnodeType: yup.object().test(
    'is-valid-nfnode-type',
    'Invalid NFNode type format',
    (value: Record<string, unknown>) => {

      const validTypes: Array<NFNodeType> = ['don', 'byod', 'wayruHotspot'];
      const keys = Object.keys(value || {});

      if (keys.length !== 1) {
        console.log('Failed: incorrect number of keys');
        return false;
      }

      const type = keys[0] as NFNodeType;
      if (!validTypes.includes(type)) {
        return false;
      }

      const isValidObject = typeof value[type] === 'object' &&
        value[type] !== null &&
        Object.keys(value[type] as object).length === 0;

      return isValidObject;
    }
  ).required('NFNode type is required')
});

export const updateHostSchema = yup.object().shape({
  walletOwnerAddress: yup.string().required('Wallet owner is required'),
  hostAddress: yup.string().required('Host address is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required')
});

export const withdrawTokensSchema = yup.object().shape({
  walletAddress: yup.string().required('Wallet address is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required'),
  userNFTTokenAccount: yup.string().required('User NFT token account is required')
});