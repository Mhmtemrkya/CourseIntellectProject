import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const reportDir = path.resolve('smoke-results');
const screenshotDir = path.join(reportDir, 'screenshots');

const destructivePattern = /sil|delete|remove|logout|cikis|çıkış|reddet|iptal|undo|geri al/i;
const roles = [
  {
    key: 'admin',
    username: 'admin@courseintlecct.com',
    password: 'Admin2026!',
    home: '/dashboard',
    routes: [
      '/dashboard',
      '/students',
      '/parents',
      '/teachers',
      '/classes',
      '/schedule',
      '/attendance',
      '/kiosk-qr',
      '/content',
      '/questions',
      '/exams',
      '/reports',
      '/settings',
      '/chat',
      '/admin/operations',
      '/admin/task-center',
      '/admin/kpi',
      '/admin/global-search',
      '/admin/personnel-approvals',
      '/admin/finance-approvals',
      '/admin/role-management',
      '/admin/records',
      '/admin/notifications',
      '/admin/documents',
      '/admin/student-registration',
      '/admin/staff-registration',
      '/admin/branch-comparison',
      '/sa/dashboard',
      '/sa/tenants',
      '/sa/plans',
      '/sa/billing',
      '/sa/system',
      '/sa/limits',
      '/sa/support',
      '/sa/ai',
      '/sa/customization',
    ],
  },
  {
    key: 'administrative',
    username: 'idari.ceren',
    password: 'CRN2026B',
    home: '/dashboard',
    routes: [
      '/dashboard',
      '/admin/operations',
      '/admin/task-center',
      '/admin/kpi',
      '/admin/records',
      '/admin/notifications',
      '/admin/documents',
      '/admin/student-registration',
      '/admin/staff-registration',
    ],
  },
  {
    key: 'finance',
    username: 'muhasebe.selim',
    password: 'MHS2026A',
    home: '/finance/dashboard',
    routes: [
      '/finance/dashboard',
      '/finance/student-accounts',
      '/finance/collections',
      '/finance/installments',
      '/finance/late-payments',
      '/finance/invoices-receipts',
      '/finance/discounts-scholarships',
      '/finance/export',
      '/finance/audit-log',
      '/finance/collection-calendar',
      '/finance/reconciliation',
      '/finance/bulk-actions',
      '/finance/detail-hub',
      '/finance/salary',
      '/finance/cash-report',
      '/finance/overdue-rules',
      '/finance/ledger',
    ],
  },
  {
    key: 'teacher',
    username: 'ogrt.hasan',
    password: 'HYN2026A',
    home: '/t/dashboard',
    routes: [
      '/t/dashboard',
      '/t/schedule',
      '/t/attendance',
      '/t/content',
      '/t/questions',
      '/t/exams',
      '/t/assignments',
      '/t/submissions',
      '/t/live-lessons',
      '/t/live-room',
      '/t/reports',
      '/t/question-bank',
      '/t/content-studio',
      '/t/question-workflow',
      '/t/exam-workbench',
      '/t/meeting-approvals',
      '/t/profile',
      '/t/chat',
    ],
  },
  {
    key: 'student',
    username: 'ali10a241',
    password: 'ALI2026A',
    home: '/s/dashboard',
    routes: [
      '/s/dashboard',
      '/s/schedule',
      '/s/content',
      '/s/exams',
      '/s/questions',
      '/s/live',
      '/s/assignments',
      '/s/study-plan',
      '/s/attendance-qr',
      '/s/wrong-answers',
      '/s/content-detail',
      '/s/question-practice',
      '/s/profile',
      '/s/ai',
      '/s/notifications',
      '/s/settings',
      '/s/chat',
    ],
  },
  {
    key: 'parent',
    username: 'veli.ayse',
    password: 'VLI2026A',
    home: '/p/dashboard',
    routes: [
      '/p/dashboard',
      '/p/attendance',
      '/p/exams',
      '/p/payments',
      '/p/children',
      '/p/weekly-report',
      '/p/feedback',
      '/p/meetings',
      '/p/receipts',
      '/p/announcements',
      '/p/excuse-request',
      '/p/profile',
      '/p/chat',
    ],
  },
];

await fs.mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  roles: [],
  summary: {
    roles: roles.length,
    pagesVisited: 0,
    failedPages: 0,
    consoleErrors: 0,
    requestFailures: 0,
    pageErrors: 0,
  },
};

for (const role of roles) {
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 1512, height: 982 },
  });

  const roleResult = {
    role: role.key,
    loginOk: false,
    loginError: null,
    pages: [],
  };

  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(10000);
  const runtimeEvents = createRuntimeEventCollector(page);

  try {
    await login(page, role);
    roleResult.loginOk = true;
  } catch (error) {
    roleResult.loginError = error instanceof Error ? error.message : String(error);
    await page.screenshot({ path: path.join(screenshotDir, `${role.key}-login-failed.png`), fullPage: true });
    report.roles.push(roleResult);
    report.summary.failedPages += 1;
    await context.close();
    continue;
  }

  for (const route of role.routes) {
    console.log(`[${role.key}] ${route}`);
    const snapshotBefore = runtimeEvents.snapshot();
    const pageResult = {
      route,
      ok: true,
      finalUrl: '',
      title: '',
      heading: '',
      buttonCount: 0,
      clickedButtons: [],
      consoleErrors: [],
      requestFailures: [],
      pageErrors: [],
      notes: [],
    };

    try {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(900);
      pageResult.finalUrl = page.url();
      pageResult.title = await page.title();
      pageResult.heading = await readHeading(page);
      pageResult.buttonCount = await page.locator('button').count();
      pageResult.clickedButtons = await clickSafeButtons(page, route);
      await page.waitForTimeout(500);
    } catch (error) {
      pageResult.ok = false;
      pageResult.notes.push(error instanceof Error ? error.message : String(error));
      await page.screenshot({
        path: path.join(screenshotDir, `${role.key}-${sanitizeFile(route)}.png`),
        fullPage: true,
      });
    }

    const snapshotAfter = runtimeEvents.snapshot();
    pageResult.consoleErrors = sliceNew(snapshotBefore.consoleErrors, snapshotAfter.consoleErrors);
    pageResult.requestFailures = sliceNew(snapshotBefore.requestFailures, snapshotAfter.requestFailures);
    pageResult.pageErrors = sliceNew(snapshotBefore.pageErrors, snapshotAfter.pageErrors);

    if (pageResult.consoleErrors.length || pageResult.requestFailures.length || pageResult.pageErrors.length) {
      pageResult.ok = false;
    }

    roleResult.pages.push(pageResult);
    report.summary.pagesVisited += 1;
    report.summary.consoleErrors += pageResult.consoleErrors.length;
    report.summary.requestFailures += pageResult.requestFailures.length;
    report.summary.pageErrors += pageResult.pageErrors.length;
    if (!pageResult.ok) {
      report.summary.failedPages += 1;
    }
  }

  report.roles.push(roleResult);
  await context.close();
}

await browser.close();
await fs.writeFile(path.join(reportDir, 'role-smoke-report.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(reportDir, 'role-smoke-report.md'), buildMarkdown(report));

console.log(`Smoke report saved to ${path.join(reportDir, 'role-smoke-report.md')}`);

function createRuntimeEventCollector(page) {
  const consoleErrors = [];
  const requestFailures = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('response', async (response) => {
    if (response.status() >= 400) {
      requestFailures.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  page.on('requestfailed', (request) => {
    requestFailures.push(`FAILED ${request.method()} ${request.url()} ${request.failure()?.errorText || 'unknown'}`);
  });

  return {
    snapshot() {
      return {
        consoleErrors: [...consoleErrors],
        requestFailures: [...requestFailures],
        pageErrors: [...pageErrors],
      };
    },
  };
}

async function login(page, role) {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(500);
  await page.fill('input[placeholder*="kullan"], input[name="username"], input[type="text"]', role.username);
  await page.fill('input[type="password"]', role.password);
  await page.getByTestId('login-button').click();
  await page.waitForURL(`**${role.home}`, { timeout: 10000 });
}

async function readHeading(page) {
  const heading = page.locator('h1, h2').first();
  if (await heading.count()) {
    return (await heading.innerText()).trim();
  }

  return '';
}

async function clickSafeButtons(page, route) {
  const clicked = [];
  const buttons = page.locator('button');
  const count = Math.min(await buttons.count(), 4);

  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if (!(await button.isVisible().catch(() => false))) {
      continue;
    }

    const text = ((await button.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ');
    if (!text || destructivePattern.test(text)) {
      continue;
    }

    const type = (await button.getAttribute('type')) || 'button';
    if (type.toLowerCase() === 'submit') {
      continue;
    }

    try {
      await button.click({ timeout: 1000 });
      await page.waitForTimeout(150);
      clicked.push(text);
      if (!page.url().includes(route)) {
        await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 10000 });
      }
    } catch {
      // Button is recorded through runtime failures if it breaks the page.
    }

    if (clicked.length >= 2) {
      break;
    }
  }

  return [...new Set(clicked)];
}

function sliceNew(previous, current) {
  return current.slice(previous.length);
}

function sanitizeFile(value) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
}

function buildMarkdown(reportData) {
  const lines = [
    '# Role Smoke Report',
    '',
    `- Generated: ${reportData.generatedAt}`,
    `- Base URL: ${reportData.baseUrl}`,
    `- Roles tested: ${reportData.summary.roles}`,
    `- Pages visited: ${reportData.summary.pagesVisited}`,
    `- Failed pages: ${reportData.summary.failedPages}`,
    `- Console errors: ${reportData.summary.consoleErrors}`,
    `- Request failures: ${reportData.summary.requestFailures}`,
    `- Page errors: ${reportData.summary.pageErrors}`,
    '',
  ];

  for (const role of reportData.roles) {
    lines.push(`## ${role.role}`);
    lines.push(`- Login: ${role.loginOk ? 'ok' : `failed (${role.loginError})`}`);
    const failedPages = role.pages.filter((page) => !page.ok);
    lines.push(`- Failed pages: ${failedPages.length}/${role.pages.length}`);
    lines.push('');

    for (const page of failedPages) {
      lines.push(`### ${page.route}`);
      if (page.heading) {
        lines.push(`- Heading: ${page.heading}`);
      }
      if (page.notes.length) {
        lines.push(`- Notes: ${page.notes.join(' | ')}`);
      }
      if (page.consoleErrors.length) {
        lines.push(`- Console: ${page.consoleErrors.join(' | ')}`);
      }
      if (page.requestFailures.length) {
        lines.push(`- Requests: ${page.requestFailures.join(' | ')}`);
      }
      if (page.pageErrors.length) {
        lines.push(`- Page errors: ${page.pageErrors.join(' | ')}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
