// Resolve at generation time; orders can predate customer discount changes.
export async function resolveInvoiceDiscount(order, Customer) {
  const customer = order.customerId
    ? await Customer.findById(order.customerId).select('discount').lean()
    : null;
  return Number(customer ? (customer.discount ?? 0) : (order.customerDiscount ?? 0));
}
