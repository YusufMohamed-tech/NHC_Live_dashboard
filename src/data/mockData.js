export const scenarios = []

export const evaluationCriteria = [
  {
    key: 'criterion1',
    label: 'الاستقبال والمظهر الخارجي',
    weight: 0.1,
  },
  {
    key: 'criterion2',
    label: 'السلوك والاحترافية',
    weight: 0.2,
  },
  {
    key: 'criterion3',
    label: 'المعرفة بالمنتج العقاري',
    weight: 0.2,
  },
  {
    key: 'criterion4',
    label: 'العرض المالي وإجراءات البيع',
    weight: 0.15,
  },
  {
    key: 'criterion5',
    label: 'تجربة العرض (الوحدة النموذجية)',
    weight: 0.15,
  },
  {
    key: 'criterion6',
    label: 'المتابعة بعد الزيارة',
    weight: 0.1,
  },
  {
    key: 'criterion7',
    label: 'الالتزام والامتثال',
    weight: 0.1,
  },
]

export const pointsRules = {
  visits: [
    { label: 'إكمال الزيارة', points: 50 },
    { label: 'رفع صورة', points: 5 },
    { label: 'رفع فيديو', points: 10 },
  ],
  issues: [
    { label: 'مشكلة بسيطة', points: 15 },
    { label: 'مشكلة متوسطة', points: 30 },
    { label: 'مشكلة خطيرة', points: 50 },
  ],
  quality: [
    { label: 'تقرير شامل', points: 25 },
    { label: 'سرعة الإكمال', points: 15 },
    { label: 'دقة المعلومات', points: 20 },
  ],
  achievements: [
    { label: 'إنجاز 5 زيارات', points: 50 },
    { label: 'إنجاز 10 زيارات', points: 100 },
    { label: 'إنجاز 20 زيارة', points: 200 },
  ],
}

export const offices = []

export const subAdmins = [
  // {
  //   id: 'admin-1',
  //   name: 'اسم المدير',
  //   email: 'admin@nhc.sa',
  //   password: '123456',
  //   city: 'الرياض',
  //   status: 'نشط',
  //   assignedShopperIds: ['shopper-1'],
  // },
]

export const shoppers = [
  // {
  //   id: 'shopper-1',
  //   name: 'اسم المتسوق',
  //   email: 'shopper@nhc.sa',
  //   password: '123456',
  //   city: 'الرياض',
  //   visits: 0,
  //   points: 0,
  //   status: 'نشط',
  // },
]

export const visits = [
  // {
  //   id: 'visit-1',
  //   officeName: 'اسم المنشأة',
  //   city: 'الرياض',
  //   type: 'مكتب مبيعات',
  //   date: '2026-01-01',
  //   time: '10:00 صباحاً',
  //   status: 'معلقة',
  //   assignedShopperId: 'shopper-1',
  //   scenario: 'وصف السيناريو',
  //   membershipId: 'NHC-00001',
  //   scores: {
  //     criterion1: 0,
  //     criterion2: 0,
  //     criterion3: 0,
  //     criterion4: 0,
  //     criterion5: 0,
  //     criterion6: 0,
  //     criterion7: 0,
  //   },
  //   notes: '',
  //   pointsEarned: 0,
  //   waitMinutes: 0,
  // },
]

export const issues = [
  // {
  //   id: 'issue-1',
  //   visitId: 'visit-1',
  //   officeName: 'اسم المنشأة',
  //   city: 'الرياض',
  //   date: '2026-01-01',
  //   severity: 'بسيطة',
  //   description: 'وصف المشكلة',
  // },
]
