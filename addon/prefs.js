/* eslint-disable no-undef */
pref("enable", true);
pref("input", "This is input");

Zotero.__addonInstance__ = {
  hooks: {
    onPrefsEvent: function(event, data) {
      if (event === 'load') {
        // 설정 창이 로드될 때 초기 상태를 설정합니다.
        const enableEmbeddingCheckbox = document.getElementById('zotero-prefpane-__addonRef__-enableEmbedding');
        if (enableEmbeddingCheckbox) {
          this.toggleEmbeddingModelInput(enableEmbeddingCheckbox.checked);
        }
      }
    }
  },

  toggleEmbeddingModelInput: function(isChecked) {
    const embeddingModelInputContainer = document.getElementById('embedding-model-input-container');
    if (embeddingModelInputContainer) {
      embeddingModelInputContainer.style.display = isChecked ? 'flex' : 'none';
    }
  }
};
