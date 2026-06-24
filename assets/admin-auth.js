/* Painel DEJUR Cerus — trava de acesso ao admin.
   Protege contra acesso casual ao link do admin.html. Não é segurança forte
   (é um site estático, sem backend de autenticação real) — qualquer pessoa
   com conhecimento técnico pode contornar isso pelo DevTools. Serve para
   impedir que alguém sem a senha grave dados na planilha por engano ou
   curiosidade ao abrir o link.

   O hash da senha vem de window.APP_CONFIG.ADMIN_PASSWORD_HASH (config.local.js
   ou config.runtime.js) — nunca fica hardcoded aqui, porque este arquivo é
   público no GitHub e um hash sem salt de uma senha previsível seria
   quebrável por força bruta/dicionário. Ver README.md. */
(function(){
  const SESSION_KEY = 'dejurAdminAuth';

  async function sha256Hex(text){
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function unlock(){
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('adminApp').style.display = '';
  }

  function configuredHash(){
    const hash = window.APP_CONFIG && window.APP_CONFIG.ADMIN_PASSWORD_HASH;
    return (hash && !hash.includes('COLOQUE_AQUI')) ? hash : null;
  }

  if(sessionStorage.getItem(SESSION_KEY) === 'ok'){
    unlock();
  }

  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('authPassword');
    const msg = document.getElementById('authMsg');
    const expected = configuredHash();

    if(!expected){
      msg.textContent = 'ADMIN_PASSWORD_HASH não configurado (ver README.md).';
      return;
    }

    const hash = await sha256Hex(input.value);
    if(hash === expected){
      sessionStorage.setItem(SESSION_KEY, 'ok');
      msg.textContent = '';
      unlock();
    } else {
      msg.textContent = 'Senha incorreta.';
      input.value = '';
      input.focus();
    }
  });
})();
