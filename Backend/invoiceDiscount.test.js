import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveInvoiceDiscount } from './invoiceDiscount.js';

const customers = (customer) => ({
  findById: () => ({ select: () => ({ lean: async () => customer }) })
});

test('uses the assigned discount even when the order was created without one', async () => {
  assert.equal(await resolveInvoiceDiscount({ customerId: 'customer', customerDiscount: 0 }, customers({ discount: 12.5 })), 12.5);
});

test('uses the current discount, including removal of an earlier discount', async () => {
  const order = { customerId: 'customer', customerDiscount: 20 };
  assert.equal(await resolveInvoiceDiscount(order, customers({ discount: 5 })), 5);
  assert.equal(await resolveInvoiceDiscount(order, customers({ discount: 0 })), 0);
  assert.equal(order.customerDiscount, 20, 'preview must not mutate the saved order');
});

test('retains the order discount when the customer no longer exists', async () => {
  assert.equal(await resolveInvoiceDiscount({ customerId: 'deleted', customerDiscount: 10 }, customers(null)), 10);
});

test('supports legacy orders without a linked customer or saved discount', async () => {
  assert.equal(await resolveInvoiceDiscount({ customerDiscount: 7.5 }, {}), 7.5);
  assert.equal(await resolveInvoiceDiscount({}, {}), 0);
});
