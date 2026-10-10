-- 서버 확인 중 글자가 깨져 잘못 들어간 기록 한 줄 삭제
delete from public.scores where id = 23 and ms = 999999 and moves = 7 and discs = 3;
