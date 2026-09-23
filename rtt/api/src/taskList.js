// The task list shown on the form, in display order.
// To add a task: add a line in the right section. To rename one: change its label only.
// Never change or reuse a code once tasks have been logged with it, because saved entries point to it.
// To stop showing a task but keep its history, add  hidden: true  to its line.
module.exports = [
  // Arrival
  { code: 'arr_beltloader', label: '15/5 belt loader / power stow', phase: 'IN' },
  { code: 'door_shield', label: 'Door shield', phase: 'IN' },
  { code: 'dl_fwd', label: 'Download FWD pit', phase: 'IN' },
  { code: 'dl_aft', label: 'Download AFT pit', phase: 'IN' },
  { code: 'deliver_cag', label: 'Deliver CAG', phase: 'IN' },
  { code: 'run_locals', label: 'Run locals', phase: 'IN' },
  { code: 'nlg_chocks', label: 'NLG chocks', phase: 'IN' },
  { code: 'mlg_chocks', label: 'MLG chocks', phase: 'IN' },
  { code: 'ww_copilot', label: 'WW co-pilot', phase: 'IN' },
  { code: 'ww_captain', label: 'WW captain', phase: 'IN' },
  { code: 'power', label: 'Power', phase: 'IN' },
  { code: 'connect_pca', label: 'Connect PCA', phase: 'IN' },
  { code: 'install_tailstand', label: 'Install tail stand', phase: 'IN' },
  // Departure
  { code: 'water', label: 'Water', phase: 'OUT' },
  { code: 'towbar', label: 'Connect towbar', phase: 'OUT' },
  { code: 'stack_fwd', label: 'Stack FWD', phase: 'OUT' },
  { code: 'stack_aft', label: 'Stack AFT', phase: 'OUT' },
  { code: 'dep_beltloader', label: '15/5 belt loader / power stow', phase: 'OUT' },
  { code: 'uninstall_tailstand', label: 'Uninstall tail stand', phase: 'OUT' },
  { code: 'throw_bags', label: 'Throw bags onto belt loader', phase: 'OUT' },
  { code: 'walkaround', label: 'Walkaround', phase: 'OUT' },
  { code: 'ride_along', label: 'Ride along', phase: 'OUT' },
  { code: 'ww_sendoff', label: 'WW send-off', phase: 'OUT' },
  { code: 'ww_disconnect', label: 'WW disconnect', phase: 'OUT' },
  { code: 'cargo_tags', label: 'Cargo tags', phase: 'OUT' },
  { code: 'collect_cag', label: 'Collect CAG', phase: 'OUT' },
  { code: 'headset', label: 'Connect headset', phase: 'OUT' },
];
