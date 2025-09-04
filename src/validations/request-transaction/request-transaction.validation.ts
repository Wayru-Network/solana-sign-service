import { InitializeNfnodeMessage, NFNodeType, NFNodeTypeEnum } from '@interfaces/request-transaction/request-transaction.interface';
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
  type: yup.string().oneOf(['owner', 'host', 'manufacturer'], 'Invalid claimer type').required('Type is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required')
});

export const initializeNfnodeSchema = yup.object().shape({
  walletOwnerAddress: yup.string().required('Wallet owner is required'),
  hostAddress: yup.string().required('Host address is required'),
  manufacturerAddress: yup.string().required('Manufacturer address is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required'),
  nonce: yup.number().required('Nonce is required'),
  nfnodeType: yup.object().test(
    'is-valid-nfnode-type',
    'Invalid NFNode type format',
    (value: Record<string, unknown>) => {

      const validTypes: Array<NFNodeTypeEnum> = ['don', 'byod', 'wayruHotspot'];
      const keys = Object.keys(value || {});

      if (keys.length !== 1) {
        console.log('Failed: incorrect number of keys');
        return false;
      }

      const type = keys[0] as NFNodeTypeEnum;
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
export const initializeStakeSchema = yup.object().shape({
  walletAddress: yup.string().required('Wallet owner is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required'),
  //validate amount to be positive and lower or equal than 100000
  amount: yup.number().required('Amount is required').positive('Amount must be positive').max(100000, 'Amount must be lower or equal than 100000'),
  nonce: yup.number().required('Nonce is required'),
});

export const updateHostSchema = yup.object().shape({
  walletOwnerAddress: yup.string().required('Wallet owner is required'),
  hostAddress: yup.string().required('Host address is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required'),
  feeToUpdateMetadata: yup.number().required('Fee to update metadata is required').positive('Fee must be positive'),
  paymentToAddHostToNFnode: yup.number().required('Payment to add host to NFNode is required').positive('Payment must be positive'),
  solanaWalletAddressAdmin: yup.string().required('Solana wallet address admin is required'),
  solanaTreasuryWalletAddress: yup.string().required('Solana treasury wallet address is required'),
  hostShare: yup.number().required('Host share is required').positive('Host share must be positive').max(99, 'Host share must not be greater than 99'),
  solanaWayruFeeTransactionAddress: yup.string().required('solana wayru fee transaction address is required'),
  wayruFeeTransaction: yup.number().required('Wayru fee transaction is required').positive('Payment must be positive'),

});

export const withdrawTokensSchema = yup.object().shape({
  walletAddress: yup.string().required('Wallet address is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required'),
  nonce: yup.number().required('Nonce is required')
});

export const withdrawStakeTokensSchema = yup.object().shape({
  walletAddress: yup.string().required('Wallet address is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required'),
  nonce: yup.number().required('Nonce is required')
});

export const claimWCreditsSchema = yup.object().shape({
  walletAddress: yup.string().required('Wallet address is required'),
  amountToClaim: yup.number().required('Amount to claim is required').positive('Amount must be positive'),
  trackerId: yup.number().required('Tracker ID is required').positive('Tracker ID must be positive')
});

export const depositTokensSchema = yup.object().shape({
  walletAddress: yup.string().required('Wallet address is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required'),
  nonce: yup.number().required('Nonce is required')
});
export const stakeTokensSchema = yup.object().shape({
  amount: yup.number().required('Amount is required'),
  walletAddress: yup.string().required('Wallet address is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required'),
  nonce: yup.number().required('Nonce is required')
});

export const updateRewardContractSchema = yup.object().shape({
  walletAddress: yup.string().required('Wallet address is required'),
  solanaAssetId: yup.string().required('Solana asset ID is required'),
  nonce: yup.number().required('Nonce is required'),
  nfnodeType: yup.object().required('NFNode type is required'),
  manufacturerAddress: yup.string().required('Manufacturer address is required'),
  hostAddress: yup.string().required('Host address is required'),
  status: yup.string().oneOf(['invalid_nfnode', 'only_init_nfnode', 'claim_and_init_nfnode'], 'Invalid status').required('Status is required')
});

