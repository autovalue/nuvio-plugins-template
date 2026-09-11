const { getStreams } = require('./index');

// Feel free to delete if tests are not needed for your provider.
// This is just a template to get you started.
describe('ProviderName', () => {
  it('should initialize correctly', () => {
    expect(typeof getStreams).toBe('function');
  });

  it('should resolve movie stream', async () => {
    const result = await getStreams('10378', 'movie', '', '');
    expect(Array.isArray(result)).toBe(true);
  });
});
