/**
 * Facts the Terms and Privacy pages need about who runs the site. They come from settings
 * rather than the code because this repository is public.
 */
export const legal = () => ({
  /** The person or company legally responsible for the site, e.g. "Example LLC". */
  operator: (process.env.LEGAL_OPERATOR ?? '').trim() || 'Live Big Bear',
  /** A public address people can write to with questions and requests. */
  email: (process.env.CONTACT_EMAIL ?? '').trim(),
  /** A postal address, required by US law in the footer of marketing emails. A PO box is fine. */
  postal: (process.env.POSTAL_ADDRESS ?? '').trim(),
});

/** The date the Terms and Privacy pages last changed. Update it whenever their wording changes. */
export const LEGAL_UPDATED = 'November 18, 2026';

export const legalMissing = () => {
  const l = legal();
  return [!process.env.LEGAL_OPERATOR && 'LEGAL_OPERATOR', !l.email && 'CONTACT_EMAIL', !l.postal && 'POSTAL_ADDRESS'].filter(Boolean) as string[];
};
