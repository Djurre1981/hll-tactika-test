INSERT OR REPLACE INTO strats (
  id, title, tags, notes, match_json, folder_id, locked, locked_by,
  slides, import_source, created_by, created_by_name, created_at, updated_at
) VALUES (
  'strat-demo-foy',
  'Demo Foy Strat',
  '{"team":"jr","type":"friendly"}',
  '',
  '{"date":"","faction":"allies","mapId":"Foy","startingPoint":"","opponent":"","result":""}',
  NULL,
  0,
  NULL,
  '[{"id":"slide-1","name":"Open","order":0,"mapId":"Foy","objects":[{"id":"obj-demo-1","type":"arrow","points":[{"x":30,"y":40},{"x":55,"y":55}],"style":{"color":"#ff4444","size":4,"lineType":"solid","endType":"end","filled":false,"fontSize":10,"textStyle":0,"textAlign":"center"},"meta":{}}]}]',
  NULL,
  'local-dev',
  'Local Dev',
  datetime('now'),
  datetime('now')
);
