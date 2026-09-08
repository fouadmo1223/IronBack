/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { QrAccessService } from '../src/modules/qr-access/qr-access.service';
import { MembersService } from '../src/modules/members/members.service';
import { AppConfig } from '../src/config/configuration';
import { AccountType, Gender, RoleKey } from '../src/common/enums';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/common/constants/permissions';
import { hashPassword } from '../src/common/utils/password.util';
import { Role, RoleDocument } from '../src/modules/roles/schemas/role.schema';
import { Branch, BranchDocument } from '../src/modules/branches/schemas/branch.schema';
import { User, UserDocument } from '../src/modules/users/schemas/user.schema';
import {
  StaffProfile,
  StaffProfileDocument,
} from '../src/modules/staff/schemas/staff-profile.schema';
import {
  MemberProfile,
  MemberProfileDocument,
} from '../src/modules/members/schemas/member-profile.schema';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from '../src/modules/subscription-plans/schemas/subscription-plan.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../src/modules/subscriptions/schemas/subscription.schema';
import {
  PaymentMethodSetting,
  PaymentMethodSettingDocument,
} from '../src/modules/payments/schemas/payment-method-setting.schema';
import { Payment, PaymentDocument } from '../src/modules/payments/schemas/payment.schema';
import {
  WhatsAppTemplate,
  WhatsAppTemplateDocument,
} from '../src/modules/whatsapp/schemas/whatsapp-template.schema';
import { CmsPage, CmsPageDocument } from '../src/modules/cms/schemas/cms-page.schema';
import {
  SiteContent,
  SiteContentDocument,
} from '../src/modules/cms/schemas/site-content.schema';
import { SubscriptionStatus, PaymentStatus, PaymentMethodType } from '../src/common/enums';

const ROLE_META: Record<RoleKey, { nameAr: string; nameEn: string }> = {
  [RoleKey.SUPER_ADMIN]: { nameAr: 'مدير عام', nameEn: 'Super Admin' },
  [RoleKey.ADMIN]: { nameAr: 'مدير', nameEn: 'Admin' },
  [RoleKey.MANAGER]: { nameAr: 'مشرف', nameEn: 'Manager' },
  [RoleKey.RECEPTIONIST]: { nameAr: 'موظف استقبال', nameEn: 'Receptionist' },
  [RoleKey.ACCOUNTANT]: { nameAr: 'محاسب', nameEn: 'Accountant' },
};

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const config = app.get(ConfigService) as ConfigService<AppConfig, true>;
  const password = config.get('seed.defaultPassword', { infer: true });

  const roleModel = app.get<Model<RoleDocument>>(getModelToken(Role.name));
  const branchModel = app.get<Model<BranchDocument>>(getModelToken(Branch.name));
  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const staffModel = app.get<Model<StaffProfileDocument>>(getModelToken(StaffProfile.name));
  const memberModel = app.get<Model<MemberProfileDocument>>(getModelToken(MemberProfile.name));
  const planModel = app.get<Model<SubscriptionPlanDocument>>(getModelToken(SubscriptionPlan.name));
  const subModel = app.get<Model<SubscriptionDocument>>(getModelToken(Subscription.name));
  const methodModel = app.get<Model<PaymentMethodSettingDocument>>(
    getModelToken(PaymentMethodSetting.name),
  );
  const paymentModel = app.get<Model<PaymentDocument>>(getModelToken(Payment.name));
  const waTemplateModel = app.get<Model<WhatsAppTemplateDocument>>(
    getModelToken(WhatsAppTemplate.name),
  );
  const cmsPageModel = app.get<Model<CmsPageDocument>>(getModelToken(CmsPage.name));
  const siteModel = app.get<Model<SiteContentDocument>>(getModelToken(SiteContent.name));

  console.log('\n▸ Seeding roles…');
  const roles = new Map<RoleKey, RoleDocument>();
  for (const key of Object.values(RoleKey)) {
    const doc = await roleModel.findOneAndUpdate(
      { key },
      {
        $set: {
          nameAr: ROLE_META[key].nameAr,
          nameEn: ROLE_META[key].nameEn,
          permissions: DEFAULT_ROLE_PERMISSIONS[key],
          isSystem: true,
          isActive: true,
        },
      },
      { new: true, upsert: true },
    );
    roles.set(key, doc);
    console.log(`  · ${key} (${doc.permissions.length} permissions)`);
  }

  console.log('\n▸ Seeding main branch…');
  const branch = await branchModel.findOneAndUpdate(
    { code: 'MAIN' },
    {
      $set: {
        nameAr: 'آيرون جيم — الفرع الرئيسي',
        nameEn: 'Iron Gym — Main Branch',
        addressAr: 'شارع التحرير، وسط البلد',
        addressEn: 'Tahrir St., Downtown',
        cityAr: 'القاهرة',
        cityEn: 'Cairo',
        phone: '+20 2 1234 5678',
        timezone: 'Africa/Cairo',
        isPrimary: true,
        isActive: true,
      },
    },
    { new: true, upsert: true },
  );
  console.log(`  · ${branch.code}`);

  console.log('\n▸ Seeding staff accounts…');
  const staffSeed: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: RoleKey;
    jobTitleEn: string;
    jobTitleAr: string;
  }> = [
    { firstName: 'Sara', lastName: 'Admin', email: 'superadmin@irongym.app', phone: '+201000000001', role: RoleKey.SUPER_ADMIN, jobTitleEn: 'Owner', jobTitleAr: 'المالك' },
    { firstName: 'Omar', lastName: 'Hassan', email: 'admin@irongym.app', phone: '+201000000002', role: RoleKey.ADMIN, jobTitleEn: 'General Manager', jobTitleAr: 'المدير العام' },
    { firstName: 'Nour', lastName: 'Adel', email: 'reception@irongym.app', phone: '+201000000003', role: RoleKey.RECEPTIONIST, jobTitleEn: 'Front Desk', jobTitleAr: 'الاستقبال' },
    { firstName: 'Karim', lastName: 'Fouad', email: 'accountant@irongym.app', phone: '+201000000004', role: RoleKey.ACCOUNTANT, jobTitleEn: 'Accountant', jobTitleAr: 'محاسب' },
  ];

  for (const s of staffSeed) {
    const passwordHash = await hashPassword(password);
    const user = await userModel.findOneAndUpdate(
      { email: s.email },
      {
        $set: {
          firstName: s.firstName,
          lastName: s.lastName,
          phone: s.phone,
          accountType: AccountType.STAFF,
          isActive: true,
          isVerified: true,
        },
        $setOnInsert: { passwordHash },
      },
      { new: true, upsert: true },
    );
    const profile = await staffModel.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          role: roles.get(s.role)!._id,
          branch: branch._id,
          jobTitleAr: s.jobTitleAr,
          jobTitleEn: s.jobTitleEn,
          isActive: true,
        },
      },
      { new: true, upsert: true },
    );
    await userModel.updateOne({ _id: user._id }, { $set: { staffProfile: profile._id } });
    console.log(`  · ${s.email} / ${password}`);
  }

  console.log('\n▸ Seeding subscription plans…');
  const PLANS = [
    {
      nameEn: 'Monthly', nameAr: 'شهري', price: 800, durationDays: 30, allowedVisits: 0,
      freezeDays: 3, isFeatured: false, displayOrder: 1,
      featuresEn: ['Full gym floor access', 'Locker room', '1 guest pass'],
      featuresAr: ['دخول كامل لصالة التدريب', 'غرفة الخزائن', 'دعوة ضيف واحدة'],
    },
    {
      nameEn: '3 Months', nameAr: '٣ شهور', price: 2100, durationDays: 90, allowedVisits: 0,
      freezeDays: 10, isFeatured: true, displayOrder: 2,
      featuresEn: ['Everything in Monthly', 'Free InBody scan', '3 guest passes', '1 PT session'],
      featuresAr: ['كل مزايا الشهري', 'قياس InBody مجاني', '٣ دعوات ضيوف', 'جلسة تدريب خاص'],
    },
    {
      nameEn: '6 Months', nameAr: '٦ شهور', price: 3600, durationDays: 180, allowedVisits: 0,
      freezeDays: 21, isFeatured: false, displayOrder: 3,
      featuresEn: ['Everything in 3 Months', 'Monthly InBody scan', 'Nutrition consult'],
      featuresAr: ['كل مزايا الـ٣ شهور', 'قياس InBody شهري', 'استشارة تغذية'],
    },
    {
      nameEn: 'Annual', nameAr: 'سنوي', price: 6000, durationDays: 365, allowedVisits: 0,
      freezeDays: 45, isFeatured: false, displayOrder: 4,
      featuresEn: ['Everything in 6 Months', '4 PT sessions', 'Priority class booking'],
      featuresAr: ['كل مزايا الـ٦ شهور', '٤ جلسات تدريب خاص', 'أولوية حجز الحصص'],
    },
  ];
  const plans: SubscriptionPlanDocument[] = [];
  for (const p of PLANS) {
    const doc = await planModel.findOneAndUpdate(
      { nameEn: p.nameEn },
      { $set: { ...p, descriptionEn: '', descriptionAr: '', isActive: true } },
      { new: true, upsert: true },
    );
    plans.push(doc);
    console.log(`  · ${p.nameEn} — EGP ${p.price}`);
  }

  console.log('\n▸ Seeding payment methods…');
  const METHODS = [
    {
      nameEn: 'InstaPay', nameAr: 'إنستاباي', type: PaymentMethodType.INSTAPAY,
      accountName: 'Iron Gym', phoneNumber: '01000000000',
      instructionsEn: 'Send to the InstaPay handle then upload the confirmation screenshot.',
      instructionsAr: 'حوّل إلى معرّف إنستاباي ثم ارفع صورة التأكيد.', displayOrder: 1,
    },
    {
      nameEn: 'Vodafone Cash', nameAr: 'فودافون كاش', type: PaymentMethodType.VODAFONE_CASH,
      accountName: 'Iron Gym', phoneNumber: '01000000001',
      instructionsEn: 'Transfer to the wallet number then upload the SMS screenshot.',
      instructionsAr: 'حوّل إلى رقم المحفظة ثم ارفع صورة الرسالة.', displayOrder: 2,
    },
    {
      nameEn: 'Bank Transfer', nameAr: 'تحويل بنكي', type: PaymentMethodType.BANK_TRANSFER,
      accountName: 'Iron Gym LLC', accountNumber: '1234567890123',
      iban: 'EG000000000000000000000000', bankNameEn: 'CIB', bankNameAr: 'التجاري الدولي',
      instructionsEn: 'Transfer to the account then upload the bank receipt.',
      instructionsAr: 'حوّل إلى الحساب ثم ارفع إيصال البنك.', displayOrder: 3,
    },
  ];
  for (const m of METHODS) {
    await methodModel.findOneAndUpdate(
      { nameEn: m.nameEn },
      { $set: { ...m, isActive: true } },
      { upsert: true },
    );
    console.log(`  · ${m.nameEn}`);
  }

  console.log('\n▸ Seeding WhatsApp templates…');
  const WA = [
    {
      key: 'EXPIRY_REMINDER', nameEn: 'Expiry reminder', nameAr: 'تذكير انتهاء',
      bodyEn: 'Hi {{name}}, your {{plan}} membership ends on {{expiry_date}} ({{remaining_days}} days left). Renew to keep training.',
      bodyAr: 'أهلاً {{name}}، اشتراك {{plan}} ينتهي في {{expiry_date}} (باقي {{remaining_days}} يوم). جدّد للاستمرار.',
    },
    {
      key: 'EXPIRED', nameEn: 'Expired', nameAr: 'منتهٍ',
      bodyEn: 'Hi {{name}}, your {{plan}} membership expired on {{expiry_date}}. We would love to have you back.',
      bodyAr: 'أهلاً {{name}}، انتهى اشتراك {{plan}} في {{expiry_date}}. في انتظار عودتك.',
    },
    {
      key: 'PAYMENT_REMINDER', nameEn: 'Payment reminder', nameAr: 'تذكير دفع',
      bodyEn: 'Hi {{name}}, there is an outstanding balance of {{remaining_amount}} on your {{plan}} subscription.',
      bodyAr: 'أهلاً {{name}}، يوجد مبلغ متبقٍّ {{remaining_amount}} على اشتراك {{plan}}.',
    },
    {
      key: 'WELCOME', nameEn: 'Welcome', nameAr: 'ترحيب',
      bodyEn: 'Welcome to Iron Gym, {{name}}! Your {{plan}} membership is active until {{expiry_date}}.',
      bodyAr: 'أهلاً بك في آيرون جيم يا {{name}}! اشتراك {{plan}} فعّال حتى {{expiry_date}}.',
    },
  ];
  for (const t of WA) {
    await waTemplateModel.findOneAndUpdate(
      { key: t.key },
      { $set: { ...t, isActive: true, isSystem: true } },
      { upsert: true },
    );
    console.log(`  · ${t.key}`);
  }

  console.log('\n▸ Seeding site content + home page…');
  await siteModel.findOneAndUpdate(
    { key: 'site' },
    {
      $set: {
        brand: { nameEn: 'IRON GYM', nameAr: 'آيرون جيم', accentColor: '#f2591f' },
        contact: {
          phone: '+20 2 1234 5678', whatsapp: '+201000000000', email: 'hello@irongym.app',
          addressEn: 'Tahrir St., Downtown, Cairo', addressAr: 'شارع التحرير، وسط البلد، القاهرة',
        },
        social: { instagram: 'https://instagram.com/irongym', facebook: 'https://facebook.com/irongym' },
        hours: {
          schedule: [
            { audience: 'men', days: ['sun', 'mon', 'tue', 'wed', 'thu'], open: '5:00 AM', close: '12:00 AM' },
            { audience: 'men', days: ['fri', 'sat'], open: '7:00 AM', close: '11:00 PM' },
            { audience: 'women', days: ['sun', 'mon', 'tue', 'wed', 'thu'], open: '9:00 AM', close: '9:00 PM' },
            { audience: 'women', days: ['fri', 'sat'], open: '10:00 AM', close: '6:00 PM' },
          ],
        },
      },
    },
    { upsert: true },
  );
  await cmsPageModel.findOneAndUpdate(
    { slug: 'home' },
    {
      $set: {
        slug: 'home', nameEn: 'Home', nameAr: 'الرئيسية',
        titleEn: 'Iron Gym — Train heavy. Live strong.',
        titleAr: 'آيرون جيم — تمرّن بقوة. عِش بقوة.',
        isPublished: true, publishedAt: new Date(),
        sections: [
          { key: 'hero', type: 'HERO', enabled: true, order: 0, data: {
            titleEn: 'Forge a body that refuses to quit', titleAr: 'ابنِ جسدًا لا يعرف الاستسلام',
            subtitleEn: 'A serious training floor, expert coaching and a membership built for people who show up.',
            subtitleAr: 'صالة تدريب جادة، وتدريب احترافي، واشتراك مصمَّم لمن يلتزم بالحضور.',
          } },
          { key: 'stats', type: 'STATS', enabled: true, order: 1, data: {
            items: [
              { valueEn: '1,200+', labelEn: 'Active members', labelAr: 'عضو نشط' },
              { valueEn: '18', labelEn: 'Certified coaches', labelAr: 'مدرب معتمد' },
              { valueEn: '900', labelEn: 'Sqm of floor', labelAr: 'متر مربع' },
              { valueEn: '119', labelEn: 'Open hours / week', labelAr: 'ساعة أسبوعيًا' },
            ],
          } },
          { key: 'about', type: 'ABOUT_PREVIEW', enabled: true, order: 2, data: {
            kickerEn: 'The gym', kickerAr: 'النادي',
            titleEn: 'No noise. Just the work.', titleAr: 'بلا ضجيج. فقط العمل.',
            bodyEn: 'We opened with one idea — a serious floor without the fluff. No queue for the rack, no chrome for its own sake. Calibrated iron, coaches who compete, and members who keep showing up.',
            bodyAr: 'بدأنا بفكرة واحدة — صالة جادة بلا زيادات. لا طابور على البار، ولا لمعان بلا هدف. حديد معايَر، ومدربون يتنافسون، وأعضاء يواظبون على الحضور.',
          } },
          { key: 'plans', type: 'MEMBERSHIP_PLANS', enabled: true, order: 3, data: {
            titleEn: 'One standard. Pick your commitment.', titleAr: 'مستوى واحد. اختر التزامك.',
          } },
          { key: 'why', type: 'WHY_US', enabled: true, order: 4, data: {
            kickerEn: 'Why us', kickerAr: 'لماذا نحن',
            titleEn: 'Why Iron Gym', titleAr: 'لماذا آيرون جيم',
            bodyEn: 'Real equipment, coaching that matters, a floor that pushes you, and doors open 119 hours a week.',
            bodyAr: 'معدات حقيقية، تدريب له قيمة، بيئة تدفعك للأمام، وأبواب مفتوحة ١١٩ ساعة أسبوعيًا.',
          } },
          { key: 'experience', type: 'TRAINING_EXPERIENCE', enabled: true, order: 5, data: {
            kickerEn: 'How it works', kickerAr: 'كيف تسير الأمور',
            titleEn: 'The training experience', titleAr: 'تجربة التدريب',
            bodyEn: 'Assess, program, train, progress — reviewed every month and adjusted as you change.',
            bodyAr: 'تقييم، برنامج، تدريب، تقدّم — تُراجَع كل شهر وتُعدَّل معك.',
          } },
          { key: 'testimonials', type: 'TESTIMONIALS', enabled: true, order: 6, data: {
            titleEn: 'What members say', titleAr: 'ماذا يقول الأعضاء',
            items: [
              { nameEn: 'Karim · 3 years', nameAr: 'كريم · ٣ سنوات',
                quoteEn: "First gym where nobody's waiting for a rack and the coaching is actually coaching.",
                quoteAr: 'أول نادٍ لا أنتظر فيه على أي جهاز، والتدريب فيه تدريب حقيقي.' },
              { nameEn: 'Nour · 2 years', nameAr: 'نور · سنتان',
                quoteEn: 'Added 40kg to my total in a year. The programming just works.',
                quoteAr: 'زدت ٤٠ كجم على مجموعي خلال سنة. البرمجة تعمل ببساطة.' },
              { nameEn: 'Hana · 18 months', nameAr: 'هنا · ١٨ شهرًا',
                quoteEn: 'Came back from a knee injury with their rehab track. Training pain-free now.',
                quoteAr: 'رجعت من إصابة ركبة عبر مسار التأهيل عندهم. أتمرّن الآن بلا ألم.' },
            ],
          } },
          { key: 'faq', type: 'FAQ', enabled: true, order: 7, data: {
            titleEn: 'Questions', titleAr: 'أسئلة',
            items: [
              { questionEn: 'Do I need experience to join?', questionAr: 'هل أحتاج خبرة للاشتراك؟',
                answerEn: 'No. Every membership starts with an assessment and a coach who builds your first block from where you actually are.',
                answerAr: 'لا. كل اشتراك يبدأ بتقييم ومدرب يبني لك أول بلوك تدريبي من حيث أنت فعلًا.' },
              { questionEn: 'Is there a joining fee?', questionAr: 'هل يوجد رسوم انضمام؟',
                answerEn: 'No joining fee. You pay for the plan you choose — monthly, quarterly, half-year or annual.',
                answerAr: 'لا رسوم انضمام. تدفع مقابل الباقة التي تختارها — شهري أو ربع سنوي أو نصف سنوي أو سنوي.' },
              { questionEn: 'How does payment work?', questionAr: 'كيف يتم الدفع؟',
                answerEn: 'Bank or wallet transfer. You upload the receipt in your member portal and it is approved within a day.',
                answerAr: 'تحويل بنكي أو محفظة. ترفع الإيصال في بوابة العضو ويُعتمد خلال يوم.' },
              { questionEn: 'Can I freeze my membership?', questionAr: 'هل أستطيع تجميد الاشتراك؟',
                answerEn: 'Yes — every plan includes freeze days. Request it from the portal and your end date moves out.',
                answerAr: 'نعم — كل باقة تتضمّن أيام تجميد. اطلبها من البوابة ويتأخّر تاريخ الانتهاء.' },
            ],
          } },
          { key: 'cta', type: 'CTA', enabled: true, order: 8, data: {
            titleEn: 'Your first session is on us', titleAr: 'جلستك الأولى علينا',
            buttonEn: 'Claim a free pass', buttonAr: 'احجز دعوة مجانية',
          } },
          { key: 'location', type: 'LOCATION', enabled: true, order: 9, data: {
            titleEn: 'Downtown Cairo', titleAr: 'وسط القاهرة',
            addressEn: 'Tahrir St., Downtown, Cairo', addressAr: 'شارع التحرير، وسط البلد، القاهرة',
            mapUrl: 'https://maps.google.com/?q=Downtown+Cairo',
          } },
        ],
      },
    },
    { upsert: true },
  );

  await cmsPageModel.findOneAndUpdate(
    { slug: 'trainers' },
    {
      $set: {
        slug: 'trainers', nameEn: 'Trainers', nameAr: 'المدربون',
        isPublished: true, publishedAt: new Date(),
        sections: [
          {
            key: 'roster', type: 'TRAINERS', enabled: true, order: 0,
            data: {
              titleEn: 'The coaching staff', titleAr: 'طاقم التدريب',
              items: [
                { nameEn: 'Omar Khaled', nameAr: 'عمر خالد', specEn: 'Powerlifting', specAr: 'رفع القوة',
                  bioEn: 'National-level lifter. Programs strength blocks and meet prep.',
                  bioAr: 'رافع على مستوى بطولات. يعدّ بلوكات القوة والتحضير للمنافسات.' },
                { nameEn: 'Yousef Amin', nameAr: 'يوسف أمين', specEn: 'Hypertrophy', specAr: 'تضخيم العضلات',
                  bioEn: 'Physique coach focused on structured volume and technique.',
                  bioAr: 'مدرب فيزيك يركّز على الحجم المنظّم والتقنية.' },
                { nameEn: 'Tarek Nabil', nameAr: 'طارق نبيل', specEn: 'Olympic lifting', specAr: 'الرفع الأولمبي',
                  bioEn: 'Snatch and clean & jerk technique, from first pull to overhead.',
                  bioAr: 'تقنية السناتش والكلين آند جيرك من أول سحبة حتى فوق الرأس.' },
                { nameEn: 'Kareem Adel', nameAr: 'كريم عادل', specEn: 'Strength & conditioning', specAr: 'قوة ولياقة',
                  bioEn: 'CSCS. Builds athletic bases for team-sport members.',
                  bioAr: 'حاصل على CSCS. يبني قواعد بدنية لأعضاء الرياضات الجماعية.' },
                { nameEn: 'Hassan Fathy', nameAr: 'حسن فتحي', specEn: 'Mobility & rehab', specAr: 'المرونة والتأهيل',
                  bioEn: 'Physio background. Return-to-training and movement work.',
                  bioAr: 'خلفية علاج طبيعي. العودة للتدريب والعمل على الحركة.' },
                { nameEn: 'Mostafa Zaki', nameAr: 'مصطفى زكي', specEn: 'Conditioning', specAr: 'اللياقة',
                  bioEn: 'Engine work that carries over — intervals, carries, erg, sled.',
                  bioAr: 'عمل هوائي له مردود — فترات، حمل، إرغ، سِلد.' },
              ],
            },
          },
        ],
      },
    },
    { upsert: true },
  );
  for (const p of [
    {
      slug: 'about', nameEn: 'About', nameAr: 'عن النادي',
      data: {
        kickerEn: 'The gym', kickerAr: 'النادي',
        titleEn: 'A training floor, not a lifestyle brand', titleAr: 'صالة تدريب، لا علامة أسلوب حياة',
        bodyEn: 'We opened in 2014 with one idea — a serious floor without the fluff.',
        bodyAr: 'افتتحنا عام ٢٠١٤ بفكرة واحدة — صالة جادة بلا زيادات.',
      },
    },
    {
      slug: 'facilities', nameEn: 'Facilities', nameAr: 'المرافق',
      data: {
        kickerEn: 'Facilities', kickerAr: 'المرافق',
        titleEn: '900 square metres of iron', titleAr: '٩٠٠ متر مربع من الحديد',
        bodyEn: 'One flagship floor, laid out for training — not for photos.',
        bodyAr: 'صالة واحدة رئيسية، مُصمّمة للتدريب — لا للصور.',
      },
    },
  ]) {
    await cmsPageModel.findOneAndUpdate(
      { slug: p.slug },
      {
        $set: {
          slug: p.slug, nameEn: p.nameEn, nameAr: p.nameAr,
          isPublished: true, publishedAt: new Date(),
          sections: [{ key: 'intro', type: 'RICH_TEXT', enabled: true, order: 0, data: p.data }],
        },
      },
      { upsert: true },
    );
  }
  console.log('  · site + home + trainers + about + facilities');

  console.log('\n▸ Seeding demo member…');
  {
    const email = 'member@irongym.app';
    const passwordHash = await hashPassword(password);
    const user = await userModel.findOneAndUpdate(
      { email },
      {
        $set: {
          firstName: 'Ahmed',
          lastName: 'Samir',
          phone: '+201111111111',
          accountType: AccountType.MEMBER,
          isActive: true,
          isVerified: true,
        },
        $setOnInsert: { passwordHash },
      },
      { new: true, upsert: true },
    );
    const existing = await memberModel.findOne({ user: user._id });
    // Randomised member code; regenerate the legacy sequential "IRON-000001" style.
    const membersService = app.get(MembersService);
    const memberCode =
      existing?.memberCode && !/^[A-Za-z]+-\d+$/.test(existing.memberCode)
        ? existing.memberCode
        : await membersService.generateMemberCode();
    const profile = await memberModel.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          memberCode,
          primaryBranch: branch._id,
          gender: Gender.MALE,
          joinDate: new Date(),
          qrEnabled: true,
        },
      },
      { new: true, upsert: true },
    );
    await userModel.updateOne({ _id: user._id }, { $set: { memberProfile: profile._id } });
    console.log(`  · ${email} / ${password}  (${memberCode})`);

    // Demo active subscription + approved payment so the dashboard has data.
    const plan = plans[1]; // 3 Months
    const start = new Date();
    const end = new Date(start.getTime() + plan.durationDays * 86_400_000);
    const sub = await subModel.findOneAndUpdate(
      { member: profile._id, planNameEn: plan.nameEn, status: SubscriptionStatus.ACTIVE },
      {
        $set: {
          member: profile._id, plan: plan._id, branch: branch._id,
          planNameAr: plan.nameAr, planNameEn: plan.nameEn, durationDays: plan.durationDays,
          allowedVisits: plan.allowedVisits, planFreezeDays: plan.freezeDays,
          startDate: start, endDate: end, status: SubscriptionStatus.ACTIVE,
          basePrice: plan.price, discountAmount: 0, finalPrice: plan.price,
          paidAmount: plan.price, remainingAmount: 0, activatedAt: start, selfServe: true,
        },
      },
      { new: true, upsert: true },
    );
    await memberModel.updateOne(
      { _id: profile._id },
      { $set: { currentSubscription: sub._id } },
    );
    await paymentModel.findOneAndUpdate(
      { subscription: sub._id, status: PaymentStatus.APPROVED },
      {
        $set: {
          member: profile._id, subscription: sub._id, amount: plan.price,
          expectedAmount: plan.price, paymentMethodLabel: 'InstaPay',
          senderName: 'Ahmed Samir', senderPhone: '+201111111111', transferDate: start,
          status: PaymentStatus.APPROVED, approvedAt: start, reviewedAt: start,
          receiptNumber: `RCPT-${start.getFullYear()}-000001`,
        },
      },
      { upsert: true },
    );
    console.log(`  · demo subscription (${plan.nameEn}) + approved payment`);

    // Issue the demo member's access QR (identity-only credential).
    const qrAccessService = app.get(QrAccessService);
    await qrAccessService.ensureForMember(profile._id);
    console.log('  · demo member access QR');
  }

  console.log('\n✔ Seed complete.\n');
  await app.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('\n✖ Seed failed:', err);
  process.exit(1);
});
