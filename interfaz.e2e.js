 test:e2e   (HEADLESS=false para ver el navegador)
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Builder, By, Key, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const URL_APP = pathToFileURL(path.join(__dirname, "..", "index.html")).href;


async function crearDriver() {
  const opciones = new chrome.Options();
  if (process.env.HEADLESS !== "false") opciones.addArguments("--headless=new");
  opciones.addArguments("--window-size=1000,900");
  if (process.getuid && process.getuid() === 0) opciones.addArguments("--no-sandbox");
  return new Builder().forBrowser("chrome").setChromeOptions(opciones).build();
}

async function abrirLimpio(driver) {
  await driver.get(URL_APP);
  await driver.executeScript("localStorage.clear()");
  await driver.navigate().refresh();
  await driver.wait(until.elementLocated(By.id("lista")), 5000);
}

async function crear(driver, titulo) {
  const campo = await driver.findElement(By.id("titulo"));
  await campo.clear();
  await campo.sendKeys(titulo);
  await driver.findElement(By.id("guardar")).click();
}

const filas = (driver) => driver.findElements(By.css("#lista li:not(.vacio)"));
const texto = (driver, id) => driver.findElement(By.id(id)).getText();

async function botonDeFila(fila, etiqueta) {
  const botones = await fila.findElements(By.css("button"));
  for (const b of botones) if ((await b.getText()) === etiqueta) return b;
  throw new Error("No se encontro el boton: " + etiqueta);
}


let driver;
test.before(async () => { driver = await crearDriver(); });
test.after(async () => { if (driver) await driver.quit(); });
test.beforeEach(async () => { await abrirLimpio(driver); });

test("SEL-21 el formulario inicial tiene placeholder, boton Agregar y Cancelar oculto", async () => {
  const campo = await driver.findElement(By.id("titulo"));
  assert.match(await campo.getAttribute("placeholder"), /Titulo/i);
  assert.strictEqual(await driver.findElement(By.id("guardar")).getText(), "Agregar");
  assert.strictEqual(await driver.findElement(By.id("cancelar")).isDisplayed(), false);
});

test("SEL-22 el campo de titulo no admite mas de 120 caracteres", async () => {
  const campo = await driver.findElement(By.id("titulo"));
  await campo.sendKeys("x".repeat(150));
  assert.strictEqual((await campo.getAttribute("value")).length, 120);
});

test("SEL-23 el mensaje de error desaparece al crear una tarea valida", async () => {
  await crear(driver, "");
  assert.match(await texto(driver, "error"), /no puede estar vacio/);
  await crear(driver, "Ahora si");
  assert.strictEqual(await texto(driver, "error"), "");
});

test("SEL-24 un titulo largo sin espacios no genera scroll horizontal en pantalla de celular", async () => {
  await driver.sendDevToolsCommand("Emulation.setDeviceMetricsOverride", {
    width: 360, height: 800, deviceScaleFactor: 1, mobile: false,
  });
  await crear(driver, "W".repeat(120));
  const desborda = await driver.executeScript(
    "return document.documentElement.scrollWidth > document.documentElement.clientWidth;"
  );
  assert.strictEqual(desborda, false);
});

test("SEL-25 si localStorage tiene datos danados, la pagina carga vacia y sigue funcionando", async () => {
  await driver.executeScript("localStorage.setItem('tareas', 'esto no es json')");
  await driver.navigate().refresh();
  await driver.wait(until.elementLocated(By.id("lista")), 5000);
  assert.match(await driver.findElement(By.id("lista")).getText(), /No hay tareas todavia/);
  await crear(driver, "Sigue funcionando");
  assert.strictEqual((await filas(driver)).length, 1);
});
