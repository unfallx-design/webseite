'use strict';
(() => {
  const input = document.getElementById('example-fee');
  if (!input) return;
  const output = document.getElementById('example-share');
  const error = document.getElementById('example-error');
  const euros = new Intl.NumberFormat('de-DE', {style:'currency',currency:'EUR'});
  function update() {
    const amount = input.valueAsNumber;
    const valid = input.validity.valid && Number.isFinite(amount);
    output.textContent = valid ? euros.format(Math.round(Math.round(amount * 100) / 2) / 100) : '–';
    input.setAttribute('aria-invalid', String(!valid));
    error.hidden = valid;
    error.textContent = valid ? '' : 'Bitte einen Betrag zwischen 0 und 100.000 € mit höchstens zwei Nachkommastellen eingeben.';
  }
  input.addEventListener('input', update);
  update();
})();
