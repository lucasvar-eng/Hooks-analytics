import { useSelector, useDispatch } from 'react-redux';
import { login as loginThunk, logout as logoutAction, fetchMe } from '../store/authSlice';
import { useEffect } from 'react';

export function useAuth() {
  const dispatch = useDispatch();
  const { user, isAuthenticated, loading, error, token } = useSelector(
    (state) => state.auth
  );

  useEffect(() => {
    if (token && !user) {
      dispatch(fetchMe());
    }
  }, [token, user, dispatch]);

  const login = (email, password) => dispatch(loginThunk({ email, password }));
  const logout = () => dispatch(logoutAction());

  return { user, isAuthenticated, loading, error, login, logout };
}