import AdminStaffRegistration from './AdminStaffRegistration';

/**
 * Akademik Yönetim altındaki aktif personel çalışma alanı.
 * Kayıt formundan ayrı bir rota kullanır; ortak düzenleme akışı tek yerde kalır.
 */
export default function AdminStaffDirectory() {
  return <AdminStaffRegistration mode="directory" />;
}
