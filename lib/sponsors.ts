/** One advertisement. For now these are written here by hand; later they will come from paying advertisers. */
export interface Sponsor {
  id: string;
  name: string;
  /** One short line under the name. */
  line: string;
  /** Where a tap goes. */
  url: string;
}

/** The ad shown in each spot. An empty spot shows nothing at all. */
export const SPONSORS: Record<'home', Sponsor | null> = {
  home: {
    id: 'somebody-cards',
    name: 'Somebody.Cards',
    line: 'One tap shares your number, site and socials.',
    url: 'https://somebody.cards/?utm_source=livebigbear&utm_medium=sponsor&utm_campaign=home',
  },
};
