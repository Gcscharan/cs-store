import { extractVoiceFilters } from '../voiceIntentParser';

describe('extractVoiceFilters', () => {
  it('returns an empty object when there are no hints', () => {
    expect(extractVoiceFilters('show me biscuits')).toEqual({});
  });

  it('parses an upper price bound from "under N"', () => {
    expect(extractVoiceFilters('biscuits under 50')).toEqual({ maxPrice: 50 });
  });

  it('parses "less than" and "below" as a max price', () => {
    expect(extractVoiceFilters('chips less than 100')).toEqual({ maxPrice: 100 });
    expect(extractVoiceFilters('snacks below 30')).toEqual({ maxPrice: 30 });
  });

  it('parses a lower price bound from "above / over / more than"', () => {
    expect(extractVoiceFilters('chocolates above 200')).toEqual({ minPrice: 200 });
    expect(extractVoiceFilters('items more than 500')).toEqual({ minPrice: 500 });
  });

  it('parses a price range from "between X and Y"', () => {
    expect(extractVoiceFilters('snacks between 20 and 100')).toEqual({
      minPrice: 20,
      maxPrice: 100,
    });
  });

  it('orders a reversed range correctly', () => {
    const r = extractVoiceFilters('between 100 and 20');
    expect(r.minPrice).toBe(20);
    expect(r.maxPrice).toBe(100);
  });

  it('ignores rupee symbols and the word rupees', () => {
    expect(extractVoiceFilters('biscuits under ₹50')).toEqual({ maxPrice: 50 });
    expect(extractVoiceFilters('chips under rs 40')).toEqual({ maxPrice: 40 });
    expect(extractVoiceFilters('chips below rupees 40')).toEqual({ maxPrice: 40 });
  });

  it('maps "cheap" to price ascending', () => {
    expect(extractVoiceFilters('show me cheap chips')).toEqual({
      sortBy: 'price',
      sortOrder: 'asc',
    });
  });

  it('maps "premium / expensive" to price descending', () => {
    expect(extractVoiceFilters('premium chocolates')).toEqual({
      sortBy: 'price',
      sortOrder: 'desc',
    });
    expect(extractVoiceFilters('expensive watches')).toEqual({
      sortBy: 'price',
      sortOrder: 'desc',
    });
  });

  it('maps "top rated" to rating descending', () => {
    expect(extractVoiceFilters('top rated coffee')).toEqual({
      sortBy: 'rating',
      sortOrder: 'desc',
    });
  });

  it('maps "newest / latest" to newest', () => {
    expect(extractVoiceFilters('newest drinks')).toEqual({
      sortBy: 'newest',
      sortOrder: 'desc',
    });
  });

  it('maps "bestseller / popular" to sales', () => {
    expect(extractVoiceFilters('popular snacks')).toEqual({
      sortBy: 'sales',
      sortOrder: 'desc',
    });
  });

  it('combines a price bound with a sort hint', () => {
    expect(extractVoiceFilters('cheap biscuits under 50')).toEqual({
      maxPrice: 50,
      sortBy: 'price',
      sortOrder: 'asc',
    });
  });

  it('parses spoken number words', () => {
    expect(extractVoiceFilters('chips under fifty')).toEqual({ maxPrice: 50 });
    expect(extractVoiceFilters('items above hundred')).toEqual({ minPrice: 100 });
  });
});
