/**
 * Enum API endpoints to provide consistent dropdown options
 * Eliminates hard-coded status lists in React components
 */

import { Router } from 'express';

const router = Router();

// Fund allocation status options
router.get('/fund_allocation_status', (req, res) => {
  const statuses = [
    { value: 'committed', label: 'Committed' },
    { value: 'partially_paid', label: 'Partially Paid' },
    { value: 'funded', label: 'Funded' },
    { value: 'unfunded', label: 'Unfunded' },
    { value: 'written_off', label: 'Written Off' }
  ];
  
  res.json(statuses);
});

// Capital call status options
router.get('/capital_call_status', (req, res) => {
  const statuses = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'called', label: 'Called' },
    { value: 'partially_paid', label: 'Partially Paid' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'defaulted', label: 'Defaulted' }
  ];
  
  res.json(statuses);
});

// Deal stages
router.get('/deal_stages', (req, res) => {
  const stages = [
    { value: 'sourcing', label: 'Sourcing' },
    { value: 'ic_review', label: 'IC Review' },
    { value: 'due_diligence', label: 'Due Diligence' },
    { value: 'negotiation', label: 'Negotiation' },
    { value: 'closing', label: 'Closing' },
    { value: 'invested', label: 'Invested' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'passed', label: 'Passed' }
  ];
  
  res.json(stages);
});

// Security types
router.get('/security_types', (req, res) => {
  const securityTypes = [
    { value: 'common_stock', label: 'Common Stock' },
    { value: 'preferred_stock', label: 'Preferred Stock' },
    { value: 'convertible_note', label: 'Convertible Note' },
    { value: 'safe', label: 'SAFE' },
    { value: 'warrant', label: 'Warrant' },
    { value: 'debt', label: 'Debt' },
    { value: 'other', label: 'Other' }
  ];
  
  res.json(securityTypes);
});

// Amount types
router.get('/amount_types', (req, res) => {
  const amountTypes = [
    { value: 'dollar', label: 'Dollar Amount' },
    { value: 'percentage', label: 'Percentage' }
  ];
  
  res.json(amountTypes);
});

// Payment types
router.get('/payment_types', (req, res) => {
  const paymentTypes = [
    { value: 'wire', label: 'Wire Transfer' },
    { value: 'check', label: 'Check' },
    { value: 'ach', label: 'ACH Transfer' },
    { value: 'other', label: 'Other' }
  ];
  
  res.json(paymentTypes);
});

// Sectors
router.get('/sectors', (req, res) => {
  const sectors = [
    { value: 'Venture', label: 'Venture' },
    { value: 'Private Credit', label: 'Private Credit' },
    { value: 'Real Estate', label: 'Real Estate' },
    { value: 'Infrastructure', label: 'Infrastructure' },
    { value: 'Growth Equity', label: 'Growth Equity' },
    { value: 'Buyout', label: 'Buyout' },
    { value: 'Distressed', label: 'Distressed' },
    { value: 'Mezzanine', label: 'Mezzanine' },
    { value: 'Other', label: 'Other' }
  ];
  
  res.json(sectors);
});

export default router;