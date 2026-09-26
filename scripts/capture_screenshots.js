import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('./docs/manual/assets');
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function startProxy(port = 3000, targetPort = 8080) {
    const server = http.createServer((req, res) => {
        const headers = { ...req.headers };
        delete headers['accept-encoding'];
        headers.host = `localhost:${targetPort}`;

        const proxyReq = http.request({
            hostname: '127.0.0.1',
            port: targetPort,
            path: req.url,
            method: req.method,
            headers: headers,
        }, (proxyRes) => {
            const resHeaders = { ...proxyRes.headers };
            const isHtml = resHeaders['content-type'] && resHeaders['content-type'].includes('text/html');

            if (isHtml) {
                delete resHeaders['content-length'];
                res.writeHead(proxyRes.statusCode, resHeaders);
                let body = '';
                proxyRes.setEncoding('utf8');
                proxyRes.on('data', chunk => body += chunk);
                proxyRes.on('end', () => {
                    const replaced = body.replace(/http:\/\/localhost:8080/g, `http://localhost:${port}`);
                    res.end(replaced);
                });
            } else {
                res.writeHead(proxyRes.statusCode, resHeaders);
                proxyRes.pipe(res, { end: true });
            }
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy error:', err.message);
            res.writeHead(502);
            res.end('Bad Gateway');
        });

        req.pipe(proxyReq, { end: true });
    });

    return new Promise((resolve) => {
        server.listen(port, '0.0.0.0', () => {
            console.log(`[Proxy] Running on http://localhost:${port} -> http://127.0.0.1:${targetPort}`);
            resolve(server);
        });
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    const proxyServer = await startProxy(3000, 8080);

    console.log('Launching Chrome on http://localhost:3000...');
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1600,1050',
        ],
        defaultViewport: {
            width: 1600,
            height: 1050,
            deviceScaleFactor: 1.5,
        }
    });

    const page = await browser.newPage();

    try {
        // 1. Login View
        console.log('1. Navigating to Login...');
        await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
        await sleep(1500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login_screen.png') });
        console.log('Captured login_screen.png');

        // Login as Super Admin
        console.log('Submitting login credentials...');
        await page.type('input[type="email"]', 'superadmin@helvest.com');
        await page.type('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');

        await sleep(3500);

        // Switch company to Acme Manufacturing S.A. if available
        try {
            const selectBoxes = await page.$$('select');
            for (const select of selectBoxes) {
                const options = await select.$$eval('option', opts => opts.map(o => ({ val: o.value, text: o.innerText })));
                const acme = options.find(o => o.text.includes('Acme') || o.val.includes('2222'));
                if (acme) {
                    console.log('Switching to company:', acme.text);
                    await page.evaluate((el, val) => {
                        el.value = val;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }, select, acme.val);
                    await sleep(2000);
                    break;
                }
            }
        } catch (e) {
            console.log('Company select note:', e.message);
        }

        // 2. Dashboard KPI
        console.log('2. Capturing Dashboard KPI...');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard_kpi.png') });
        console.log('Captured dashboard_kpi.png');

        // Scroll down to Benchmarks on Dashboard
        console.log('Capturing Dashboard Benchmarks...');
        await page.evaluate(() => window.scrollBy(0, 550));
        await sleep(800);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard_benchmarks.png') });
        console.log('Captured dashboard_benchmarks.png');
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(400);

        // Navigation Helper
        async function navigateTo(navText) {
            const clicked = await page.evaluate((text) => {
                const buttons = Array.from(document.querySelectorAll('nav button, nav a, aside button, aside a'));
                const btn = buttons.find(b => b.textContent && b.textContent.includes(text));
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            }, navText);
            if (!clicked) {
                console.warn(`Could not find nav button for: ${navText}`);
            }
            await sleep(2500);
            return clicked;
        }

        // 3. Analytics View
        console.log('3. Capturing Analytics View...');
        await navigateTo('Analityka');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'analytics_overview.png') });
        console.log('Captured analytics_overview.png');

        await page.evaluate(() => window.scrollBy(0, 600));
        await sleep(800);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'analytics_breakdown.png') });
        console.log('Captured analytics_breakdown.png');
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(400);

        // 4. Records View
        console.log('4. Capturing Records View...');
        await navigateTo('Rejestr');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'records_table.png') });
        console.log('Captured records_table.png');

        // Open add record modal
        try {
            const addBtn = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const b = btns.find(el => el.textContent && (el.textContent.includes('Nowy wpis') || el.textContent.includes('Dodaj wpis') || el.textContent.includes('Dodaj pozycję') || el.textContent.includes('Nowy rekord')));
                if (b) {
                    b.click();
                    return true;
                }
                return false;
            });
            if (addBtn) {
                await sleep(1000);
                await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'record_form_modal.png') });
                console.log('Captured record_form_modal.png');
                await page.keyboard.press('Escape');
                await sleep(500);
            }
        } catch (e) {
            console.log('Modal capture note:', e.message);
        }

        // 5. Investment Planning View
        console.log('5. Capturing Investment Planning...');
        await navigateTo('Inwestycje');
        await sleep(2000);

        // Tab 1: Założenia & CAPEX
        console.log('Capturing Investment Tab 1: Założenia & CAPEX...');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'investments_capex_assumptions.png') });
        console.log('Captured investments_capex_assumptions.png');

        // Click "Dodaj Etap" to capture CAPEX form modal
        try {
            const stageBtn = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const b = btns.find(el => el.textContent && (el.textContent.includes('Dodaj Etap') || el.textContent.includes('Nowy Etap')));
                if (b) {
                    b.click();
                    return true;
                }
                return false;
            });
            if (stageBtn) {
                await sleep(1000);
                await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'formularz_capex.png') });
                console.log('Captured formularz_capex.png');
                await page.keyboard.press('Escape');
                await sleep(500);
            }
        } catch (e) {}

        // Helper to click subtabs inside investment view
        async function clickInvestmentTab(tabId) {
            await page.evaluate((id) => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const b = buttons.find(el => el.textContent && el.textContent.includes(id));
                if (b) b.click();
            }, tabId);
            await sleep(2500);
        }

        // Tab 2: Symulator What-If
        console.log('Capturing Investment Tab 2: Symulator What-If...');
        await clickInvestmentTab('Symulator What-If');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'investments_whatif_sensitivity.png') });
        console.log('Captured investments_whatif_sensitivity.png');

        // Tab 3: Model 15-letni & Wycena
        console.log('Capturing Investment Tab 3: Model 15-letni...');
        await clickInvestmentTab('Model 15-letni');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'investments_three_statement_model.png') });
        console.log('Captured investments_three_statement_model.png');

        // Scroll down to Exit Valuation & Waterfall
        await page.evaluate(() => window.scrollBy(0, 850));
        await sleep(1000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'investments_exit_waterfall.png') });
        console.log('Captured investments_exit_waterfall.png');
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(400);

        // Tab 4: Scoring & Dossier PDF
        console.log('Capturing Investment Tab 4: Scoring & Dossier...');
        await clickInvestmentTab('Scoring & Dossier');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'investments_dossier_scorecard.png') });
        console.log('Captured investments_dossier_scorecard.png');

        // 6. Import View
        console.log('6. Capturing Import View...');
        await navigateTo('Import');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'import_csv_view.png') });
        console.log('Captured import_csv_view.png');

        // 7. Data Room (VDR)
        console.log('7. Capturing Data Room View...');
        await navigateTo('Data Room');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'data_room_vdr.png') });
        console.log('Captured data_room_vdr.png');

        // 8. Reports View
        console.log('8. Capturing Reports View...');
        await navigateTo('Raporty');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'reports_view.png') });
        console.log('Captured reports_view.png');

        // 9. Audit Logs View
        console.log('9. Capturing Audit Logs View...');
        await navigateTo('Ścieżka');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'audit_logs_view.png') });
        console.log('Captured audit_logs_view.png');

        // 10. Advisors Management View
        console.log('10. Capturing Advisors Management View...');
        await navigateTo('Doradcy');
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'advisors_management_view.png') });
        console.log('Captured advisors_management_view.png');

        console.log('SUCCESS: All screenshots captured and saved to ./docs/manual/assets/');
    } finally {
        await browser.close();
        proxyServer.close();
    }
}

run().catch(err => {
    console.error('Execution error:', err);
    process.exit(1);
});
