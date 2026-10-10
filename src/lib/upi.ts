export function validUpi(id: string, name: string) {
  return /^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$/.test(id) && id.length <= 100 && name.trim().length > 0 && name.trim().length <= 100;
}
export function upiUri(id: string, name: string, amount: number, plan: string) {
  if (!validUpi(id, name) || !Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid UPI account and plan price.");
  return `upi://pay?${new URLSearchParams({ pa: id, pn: name.trim(), am: amount.toFixed(2), cu: "INR", tn: `Namma Spot ${plan} subscription` })}`;
}