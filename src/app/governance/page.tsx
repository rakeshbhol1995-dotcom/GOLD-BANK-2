import React from 'react';
import { MultisigGovernancePortal } from '@/components/MultisigGovernancePortal';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governance & Multisig Portal — Virtual Gold ($GOLD)',
  description: 'On-chain 48-hour timelock multisig governance dashboard for Virtual Gold Protocol',
};

export default function GovernancePage() {
  return <MultisigGovernancePortal />;
}
