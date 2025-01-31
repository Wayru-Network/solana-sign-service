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
  solanaAssetId: yup.string().required('Solana asset ID is required')
});

export const updateHostSchema = yup.object().shape({
  walletOwnerAddress: yup.string().required('Wallet owner is required'),
  hostAddress: yup.string().required('Host address is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required')
});
