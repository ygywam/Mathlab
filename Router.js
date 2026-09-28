function renderMathLab(e) {
  const template = HtmlService.createTemplateFromFile('index');
  template.route = normalizeRoute(e.parameter || {});
  return template.evaluate()
    .setTitle('수학 실험실 v2.0🧪')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no');
}

function normalizeRoute(params) {
  return {
    app: params.app || 'home',
    game: params.game || '',
    mode: params.mode || 'solo',
    topic: params.topic || '',
    level: params.level || ''
  };
}
