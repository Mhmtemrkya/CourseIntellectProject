import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Clock3, Video, XCircle, Loader2, Camera, Save,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { LoadingDots } from '../animations/AnimatedIcon';
import { fetchPlannedExamAttendance, savePlannedExamAttendance } from '../../lib/api/modules';

const STATUS_OPTIONS = [
  ['Present', 'Var', CheckCircle2, 'text-emerald-600'],
  ['Late', 'Geç', Clock3, 'text-amber-600'],
  ['Absent', 'Yok', XCircle, 'text-red-600'],
];

function statusMeta(status) {
  return STATUS_OPTIONS.find((item) => item[0] === status) || STATUS_OPTIONS[2];
}

// Planlı sınavın yoklama listesi. Canlı yayına/kameraya girenler otomatik
// "Var" gelir; öğretmen burada Var/Geç/Yok olarak düzeltebilir.
export default function ExamAttendanceDialog({ exam, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchPlannedExamAttendance(exam.id);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Yoklama alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [exam.id]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = (index, status) => {
    setRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, status, manualOverride: true } : row)));
  };

  const counts = useMemo(() => ({
    present: rows.filter((r) => r.status === 'Present').length,
    late: rows.filter((r) => r.status === 'Late').length,
    absent: rows.filter((r) => r.status === 'Absent').length,
  }), [rows]);

  const save = async () => {
    try {
      setSaving(true);
      setError('');
      await savePlannedExamAttendance(exam.id, {
        entries: rows.map((row) => ({
          studentUserId: row.studentUserId || null,
          studentUsername: row.studentUsername || '',
          studentName: row.studentName || '',
          className: row.className || '',
          status: row.status || 'Absent',
        })),
      });
      await load();
    } catch (err) {
      setError(err.message || 'Yoklama kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(96vw,820px)] max-w-[820px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sınav Yoklaması — {exam.title}</DialogTitle>
        </DialogHeader>

        <div className="mb-4 grid grid-cols-3 gap-3">
          {[
            ['Var', counts.present, 'text-emerald-600'],
            ['Geç', counts.late, 'text-amber-600'],
            ['Yok', counts.absent, 'text-red-600'],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-2xl border bg-card p-3 text-center">
              <p className={`text-2xl font-black ${tone}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {error ? <p className="mb-3 rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-600">{error}</p> : null}

        {loading ? (
          <div className="py-12 text-center"><LoadingDots /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Bu sınav için öğrenci/giriş kaydı bulunamadı.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, index) => {
              const [, label, Icon, tone] = statusMeta(row.status);
              return (
                <div key={row.studentUsername || row.studentName || index} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{row.studentName || row.studentUsername || 'Öğrenci'}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}><Icon className="h-3.5 w-3.5" />{label}</span>
                      {row.joinedLive ? <span className="inline-flex items-center gap-1 text-sky-600"><Video className="h-3.5 w-3.5" /> Canlı</span> : null}
                      {row.cameraReady ? <span className="inline-flex items-center gap-1 text-violet-600"><Camera className="h-3.5 w-3.5" /> Kamera</span> : null}
                      {row.checkedInAtUtc ? <span>{new Date(row.checkedInAtUtc).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span> : null}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {STATUS_OPTIONS.map(([key, optLabel]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatus(index, key)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${row.status === key ? 'bg-brand-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                      >
                        {optLabel}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Kapat</Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Yoklamayı Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
