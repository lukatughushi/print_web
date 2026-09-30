import useToast from '../store/toastStore';
import s from './Toast.module.css';

export default function Toast() {
  const message = useToast((st) => st.message);
  if (!message) return null;
  return <div className={s.toast} role="status">✓ {message}</div>;
}
