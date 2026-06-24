/* Configuração do Painel DEJUR Cerus.
   SHEET_CSV_URL é só leitura e já é o mesmo dado exibido no painel público,
   então é seguro deixar versionado. APPS_SCRIPT_URL (grava na planilha) e
   ADMIN_PASSWORD_HASH (senha do admin) não ficam aqui — ver config.local.js
   e o README.md. */
window.APP_CONFIG = {
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/1BCCP9Ghka9nXjna-16FraSN-nqc7EX1AaWKexCQabHQ/export?format=csv&gid=0",
  APPS_SCRIPT_URL: "COLOQUE_AQUI_O_LINK_DO_APPS_SCRIPT",
  ADMIN_PASSWORD_HASH: "COLOQUE_AQUI_O_HASH_SHA256_DA_SENHA",
};
