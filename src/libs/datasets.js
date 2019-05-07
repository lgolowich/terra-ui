// If dataset has Data Explorer:
// - name must be name from dataset.json
// - authDomain must be authorization_domain from dataset.json
export default {
  thousandGenomes: {
    name: '1000 Genomes',
    dataExplorer: 'https://test-data-explorer.appspot.com/?embed'
  },
  ampPd: {
    name: 'AMP PD - 2019_v1beta_0220',
    dataExplorer: 'https://amp-pd-data-explorer.appspot.com/?embed'
  },
  baseline: {
    name: 'Baseline Health Study',
    dataExplorer: 'https://baseline-baseline-explorer.appspot.com/?embed'
  },
  nhs: {
    name: 'Nurses\' Health Study',
    authDomain: 'nhs_saturn_users',
    applyForAccess: 'https://www.nurseshealthstudy.org/researchers',
    dataExplorer: 'https://nhs-explorer.appspot.com/?embed'
  },
  ukbb: {
    name: 'UK Biobank',
    dataExplorer: 'https://biobank-explorer.appspot.com/?embed'
  }
}
