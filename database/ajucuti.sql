

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key character varying(50) NOT NULL,
    value text NOT NULL
);


--
-- Name: blackout_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blackout_periods (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL
);


--
-- Name: blackout_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.blackout_periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: blackout_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.blackout_periods_id_seq OWNED BY public.blackout_periods.id;


--
-- Name: divisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.divisions (
    id integer NOT NULL,
    code character varying(30),
    name character varying(100) NOT NULL,
    description text,
    leader_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: divisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.divisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: divisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.divisions_id_seq OWNED BY public.divisions.id;


--
-- Name: holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays (
    id integer NOT NULL,
    holiday_date date NOT NULL,
    name character varying(100) NOT NULL,
    is_joint_leave boolean DEFAULT false NOT NULL
);


--
-- Name: holidays_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: holidays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.holidays_id_seq OWNED BY public.holidays.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days numeric(4,1) NOT NULL,
    reason text NOT NULL,
    attachment_path character varying(255),
    attachment_name character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    leader_id integer,
    leader_note text,
    leader_acted_at timestamp with time zone,
    hrd_id integer,
    hrd_note text,
    hrd_acted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    request_date date DEFAULT CURRENT_DATE NOT NULL,
    is_half_day boolean DEFAULT false NOT NULL,
    handover_user_id integer,
    handover_notes text,
    address_during_leave text,
    emergency_phone character varying(20),
    rejected_by character varying(10),
    cancel_reason text,
    CONSTRAINT chk_leave_requests_dates CHECK ((end_date >= start_date)),
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved_leader'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT leave_requests_total_days_check CHECK ((total_days > (0)::numeric))
);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_types (
    id integer NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    max_days_per_request integer,
    deducts_annual_quota boolean DEFAULT true NOT NULL,
    requires_attachment boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    quota_per_year numeric(5,1),
    min_notice_days integer DEFAULT 0 NOT NULL,
    max_backdate_days integer DEFAULT 0 NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    CONSTRAINT leave_types_max_days_per_request_check CHECK (((max_days_per_request IS NULL) OR (max_days_per_request > 0)))
);


--
-- Name: leave_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_types_id_seq OWNED BY public.leave_types.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    employee_code character varying(30),
    full_name character varying(120) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    division_id integer,
    "position" character varying(100),
    phone character varying(30),
    annual_leave_quota integer DEFAULT 12 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    username character varying(50) NOT NULL,
    join_date date DEFAULT CURRENT_DATE NOT NULL,
    address text,
    photo_path text,
    CONSTRAINT users_annual_leave_quota_check CHECK ((annual_leave_quota >= 0)),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying, 'leader'::character varying, 'hrd'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: blackout_periods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blackout_periods ALTER COLUMN id SET DEFAULT nextval('public.blackout_periods_id_seq'::regclass);


--
-- Name: divisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.divisions ALTER COLUMN id SET DEFAULT nextval('public.divisions_id_seq'::regclass);


--
-- Name: holidays id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays ALTER COLUMN id SET DEFAULT nextval('public.holidays_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: leave_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types ALTER COLUMN id SET DEFAULT nextval('public.leave_types_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.app_settings VALUES ('max_team_leave_percent', '50');


--
-- Data for Name: blackout_periods; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: divisions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.divisions VALUES (4, 'OPS', 'Operasional', 'Operasional harian dan layanan internal perusahaan', NULL, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:21:54.697168+08');
INSERT INTO public.divisions VALUES (1, 'IT', 'Teknologi Informasi', 'Pengembangan aplikasi, infrastruktur, dan dukungan teknis', 3, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:21:54.697168+08');
INSERT INTO public.divisions VALUES (2, 'FIN', 'Keuangan', 'Pengelolaan anggaran, akuntansi, dan penggajian', 4, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:21:54.697168+08');
INSERT INTO public.divisions VALUES (3, 'HR', 'Sumber Daya Manusia', 'Rekrutmen, administrasi kepegawaian, dan manajemen cuti', NULL, '2026-11-21 15:21:54.697168+08', '2026-11-22 13:40:20.204012+08');


--
-- Data for Name: holidays; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.holidays VALUES (1, '2026-12-24', 'Cuti Bersama Kelahiran Yesus Kristus (Natal)', true);
INSERT INTO public.holidays VALUES (2, '2026-12-25', 'Kelahiran Yesus Kristus (Natal)', false);
INSERT INTO public.holidays VALUES (3, '2027-01-01', 'Tahun Baru 2027 Masehi', false);
INSERT INTO public.holidays VALUES (4, '2027-01-05', 'Isra Mikraj Nabi Muhammad SAW 1448 H', false);
INSERT INTO public.holidays VALUES (5, '2027-02-05', 'Cuti Bersama Tahun Baru Imlek 2578 Kongzili', true);
INSERT INTO public.holidays VALUES (6, '2027-02-06', 'Tahun Baru Imlek 2578 Kongzili', false);
INSERT INTO public.holidays VALUES (7, '2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka 1949)', false);
INSERT INTO public.holidays VALUES (8, '2027-03-09', 'Cuti Bersama Idulfitri 1448 Hijriah', true);
INSERT INTO public.holidays VALUES (9, '2027-03-10', 'Hari Raya Idulfitri 1448 Hijriah', false);
INSERT INTO public.holidays VALUES (10, '2027-03-11', 'Hari Raya Idulfitri 1448 Hijriah', false);
INSERT INTO public.holidays VALUES (11, '2027-03-12', 'Cuti Bersama Idulfitri 1448 Hijriah', true);
INSERT INTO public.holidays VALUES (12, '2027-03-15', 'Cuti Bersama Idulfitri 1448 Hijriah', true);
INSERT INTO public.holidays VALUES (13, '2027-03-25', 'Cuti Bersama Wafat Yesus Kristus', true);
INSERT INTO public.holidays VALUES (14, '2027-03-26', 'Wafat Yesus Kristus', false);
INSERT INTO public.holidays VALUES (15, '2027-03-28', 'Kebangkitan Yesus Kristus (Paskah)', false);
INSERT INTO public.holidays VALUES (16, '2027-05-01', 'Hari Buruh Internasional', false);
INSERT INTO public.holidays VALUES (17, '2027-05-06', 'Kenaikan Yesus Kristus', false);
INSERT INTO public.holidays VALUES (18, '2027-05-17', 'Hari Raya Iduladha 1448 Hijriah', false);
INSERT INTO public.holidays VALUES (19, '2027-05-18', 'Cuti Bersama Iduladha 1448 Hijriah', true);
INSERT INTO public.holidays VALUES (20, '2027-05-19', 'Cuti Bersama Hari Raya Waisak 2571 BE', true);
INSERT INTO public.holidays VALUES (21, '2027-05-20', 'Hari Raya Waisak 2571 BE', false);
INSERT INTO public.holidays VALUES (22, '2027-06-01', 'Hari Lahir Pancasila', false);
INSERT INTO public.holidays VALUES (23, '2027-06-06', '1 Muharam Tahun Baru Islam 1449 Hijriah', false);
INSERT INTO public.holidays VALUES (24, '2027-08-15', 'Maulid Nabi Muhammad SAW', false);
INSERT INTO public.holidays VALUES (25, '2027-08-17', 'Proklamasi Kemerdekaan RI', false);
INSERT INTO public.holidays VALUES (26, '2027-12-24', 'Cuti Bersama Kelahiran Yesus Kristus (Natal)', true);
INSERT INTO public.holidays VALUES (27, '2027-12-25', 'Kelahiran Yesus Kristus (Natal)', false);
INSERT INTO public.holidays VALUES (28, '2027-12-26', 'Isra Mikraj Nabi Muhammad SAW 1449 H', false);


--
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.leave_requests VALUES (1, 5, 1, '2026-02-10', '2026-02-12', 3.0, 'Keperluan acara keluarga di luar kota.', NULL, NULL, 'approved', 3, 'Disetujui, pekerjaan sprint sudah diserahterimakan.', '2026-11-01 15:21:54.697168+08', 2, 'Disetujui oleh HRD.', '2026-11-02 15:21:54.697168+08', NULL, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:21:54.697168+08', '2026-11-21', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.leave_requests VALUES (2, 5, 1, '2026-04-15', '2026-04-16', 2.0, 'Mengurus dokumen kependudukan dan keperluan pribadi.', NULL, NULL, 'approved_leader', 3, 'Silakan diteruskan ke HRD.', '2026-11-19 15:21:54.697168+08', NULL, NULL, NULL, NULL, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:21:54.697168+08', '2026-11-21', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.leave_requests VALUES (4, 5, 2, '2026-03-04', '2026-03-05', 2.0, 'Demam tinggi dan disarankan istirahat oleh dokter.', NULL, NULL, 'approved', 3, 'Semoga lekas sembuh.', '2026-11-09 15:21:54.697168+08', 2, 'Surat dokter telah diverifikasi.', '2026-11-10 15:21:54.697168+08', NULL, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:21:54.697168+08', '2026-11-21', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.leave_requests VALUES (5, 6, 1, '2026-03-25', '2026-03-26', 2.0, 'Rencana liburan keluarga.', NULL, NULL, 'rejected', 4, 'Mohon dijadwalkan ulang karena bertepatan dengan tutup buku akhir bulan.', '2026-11-13 15:21:54.697168+08', NULL, NULL, NULL, NULL, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:21:54.697168+08', '2026-11-21', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.leave_requests VALUES (6, 6, 1, '2026-04-02', '2026-04-02', 1.0, 'Mengurus perpanjangan SIM.', NULL, NULL, 'cancelled', NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-16 15:21:54.697168+08', '2026-11-21 15:21:54.697168+08', '2026-11-21 15:21:54.697168+08', '2026-11-21', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.leave_requests VALUES (9, 5, 4, '2026-12-09', '2026-12-09', 0.5, 'kajian', NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-21 18:44:10.4089+08', '2026-11-21 18:44:10.4089+08', '2026-11-21', true, NULL, NULL, 'jl.kanjov', '081200000005', NULL, NULL);
INSERT INTO public.leave_requests VALUES (8, 5, 1, '2026-11-24', '2026-11-30', 5.0, 'Malas', NULL, NULL, 'cancelled', NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-21 18:45:08.842193+08', '2026-11-21 18:40:27.82834+08', '2026-11-21 18:45:08.842193+08', '2026-11-21', false, 3, NULL, 'jl.kanjov', '081200000005', NULL, 'saya sudah raajin');
INSERT INTO public.leave_requests VALUES (11, 5, 3, '2026-12-23', '2027-05-16', 89.0, 'adaalah', '/uploads/leaves/5-1795258389332-40c6ea2c-0549-4119-bbd3-eba061b0a3e6.png', 'Cuplikan layar 2026-10-15 132421.png', 'rejected', 3, 'kamu laki laki', '2026-11-21 19:07:47.054873+08', NULL, NULL, NULL, NULL, '2026-11-21 18:53:43.610789+08', '2026-11-21 19:07:47.054873+08', '2026-11-21', false, NULL, NULL, 'jl.kanjov', '081200000005', 'leader', NULL);
INSERT INTO public.leave_requests VALUES (3, 5, 1, '2026-05-08', '2026-05-08', 1.0, 'Keperluan keluarga mendadak.', NULL, NULL, 'rejected', 3, 'banyak tugas', '2026-11-21 19:08:38.306871+08', NULL, NULL, NULL, NULL, '2026-11-21 15:21:54.697168+08', '2026-11-21 19:08:38.306871+08', '2026-11-21', false, NULL, NULL, NULL, NULL, 'leader', NULL);
INSERT INTO public.leave_requests VALUES (10, 5, 1, '2026-12-02', '2026-12-02', 0.5, 'sudah kaya', NULL, NULL, 'approved', 3, NULL, '2026-11-21 19:08:10.615552+08', 2, NULL, '2026-11-21 19:11:02.61243+08', NULL, '2026-11-21 18:46:21.885237+08', '2026-11-21 19:11:02.61243+08', '2026-11-21', true, NULL, NULL, 'jl.kanjov', '081200000005', NULL, NULL);
INSERT INTO public.leave_requests VALUES (7, 3, 1, '2026-06-11', '2026-06-12', 2.0, 'Cuti tahunan untuk menghadiri wisuda adik.', NULL, NULL, 'approved', NULL, NULL, NULL, 2, NULL, '2026-11-21 19:11:06.827288+08', NULL, '2026-11-21 15:21:54.697168+08', '2026-11-21 19:11:06.827288+08', '2026-11-21', false, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.leave_requests VALUES (13, 5, 1, '2026-11-26', '2026-11-26', 0.5, 'ada urusan', NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-11-22 20:55:12.401016+08', '2026-11-22 20:55:12.401016+08', '2026-11-22', true, 6, NULL, 'auaa', '081200000005', NULL, NULL);
INSERT INTO public.leave_requests VALUES (12, 6, 1, '2026-11-24', '2026-12-04', 9.0, 'liburan', NULL, NULL, 'approved_leader', 4, NULL, '2026-11-22 20:58:08.027426+08', NULL, NULL, NULL, NULL, '2026-11-21 19:06:31.483586+08', '2026-11-22 20:58:08.027426+08', '2026-11-21', false, NULL, NULL, 'uuauuaa', '081200000006', NULL, NULL);


--
-- Data for Name: leave_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.leave_types VALUES (1, 'ANNUAL', 'Cuti Tahunan', 'Cuti reguler tahunan karyawan yang memotong jatah cuti tahunan.', 12, true, false, true, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:23:34.970119+08', 12.0, 3, 0, true);
INSERT INTO public.leave_types VALUES (2, 'SICK', 'Cuti Sakit', 'Cuti karena kondisi kesehatan dengan lampiran surat keterangan dokter.', 14, false, true, true, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:23:34.970119+08', NULL, 0, 3, true);
INSERT INTO public.leave_types VALUES (3, 'MATERNITY', 'Cuti Melahirkan', 'Cuti melahirkan sesuai ketentuan ketenagakerjaan dengan surat dokter/bidan.', 90, false, true, true, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:23:34.970119+08', 90.0, 30, 0, false);
INSERT INTO public.leave_types VALUES (4, 'IMPORTANT', 'Cuti Alasan Penting', 'Cuti keperluan keluarga mendesak (menikah, kelahiran anak, atau duka).', 3, false, false, true, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:23:34.970119+08', 3.0, 0, 0, false);


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notifications VALUES (1, 3, 'Andi Pratama mengajukan Cuti Tahunan (5 hari) dan menunggu verifikasi Anda.', false, '2026-11-21 18:40:27.82834');
INSERT INTO public.notifications VALUES (2, 3, 'Andi Pratama mengajukan Cuti Alasan Penting (0,5 hari) dan menunggu verifikasi Anda.', false, '2026-11-21 18:44:10.4089');
INSERT INTO public.notifications VALUES (3, 3, 'Andi Pratama mengajukan Cuti Tahunan (0,5 hari) dan menunggu verifikasi Anda.', false, '2026-11-21 18:46:21.885237');
INSERT INTO public.notifications VALUES (4, 3, 'Andi Pratama mengajukan Cuti Melahirkan (89 hari) dan menunggu verifikasi Anda.', false, '2026-11-21 18:53:43.610789');
INSERT INTO public.notifications VALUES (5, 4, 'Dewi Lestari mengajukan Cuti Tahunan (9 hari) dan menunggu verifikasi Anda.', false, '2026-11-21 19:06:31.483586');
INSERT INTO public.notifications VALUES (6, 5, 'Pengajuan Cuti Melahirkan Anda ditolak oleh Ketua Divisi. Catatan: kamu laki laki', false, '2026-11-21 19:07:47.054873');
INSERT INTO public.notifications VALUES (7, 5, 'Pengajuan Cuti Tahunan Anda disetujui oleh Ketua Divisi dan diteruskan ke HRD.', false, '2026-11-21 19:08:10.615552');
INSERT INTO public.notifications VALUES (8, 2, 'Pengajuan Cuti Tahunan milik Andi Pratama telah disetujui Ketua Divisi dan menunggu persetujuan final HRD.', false, '2026-11-21 19:08:10.615552');
INSERT INTO public.notifications VALUES (9, 5, 'Pengajuan Cuti Tahunan Anda ditolak oleh Ketua Divisi. Catatan: banyak tugas', false, '2026-11-21 19:08:38.306871');
INSERT INTO public.notifications VALUES (10, 5, 'Pengajuan Cuti Tahunan Anda telah disetujui secara final oleh HRD.', false, '2026-11-21 19:11:02.61243');
INSERT INTO public.notifications VALUES (11, 3, 'Pengajuan Cuti Tahunan Anda telah disetujui secara final oleh HRD.', false, '2026-11-21 19:11:06.827288');
INSERT INTO public.notifications VALUES (12, 3, 'Andi Pratama mengajukan Cuti Tahunan (0,5 hari) dan menunggu verifikasi Anda.', false, '2026-11-22 20:55:12.401016');
INSERT INTO public.notifications VALUES (13, 6, 'Pengajuan Cuti Tahunan Anda disetujui oleh Ketua Divisi dan diteruskan ke HRD.', false, '2026-11-22 20:58:08.027426');
INSERT INTO public.notifications VALUES (14, 2, 'Pengajuan Cuti Tahunan milik Dewi Lestari telah disetujui Ketua Divisi dan menunggu persetujuan final HRD.', false, '2026-11-22 20:58:08.027426');
INSERT INTO public.notifications VALUES (15, 7, 'Pengajuan Cuti Tahunan milik Dewi Lestari telah disetujui Ketua Divisi dan menunggu persetujuan final HRD.', false, '2026-11-22 20:58:08.027426');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES (3, 'LDR-001', 'Budi Santoso', 'leader.it@ajucuti.local', '$2b$10$S5.oIXwp1nXTJ5lVvKGSauitrdZ3MWoismaI1rM5kXjnG1osR9Umq', 'leader', 1, 'Ketua Divisi IT', '081200000003', 12, true, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:23:34.970119+08', 'leader.it', '2023-11-21', NULL, NULL);
INSERT INTO public.users VALUES (4, 'LDR-002', 'Rina Kusuma', 'leader.fin@ajucuti.local', '$2b$10$S5.oIXwp1nXTJ5lVvKGSauitrdZ3MWoismaI1rM5kXjnG1osR9Umq', 'leader', 2, 'Ketua Divisi Keuangan', '081200000004', 12, true, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:23:34.970119+08', 'leader.fin', '2023-11-21', NULL, NULL);
INSERT INTO public.users VALUES (5, 'EMP-001', 'Andi Pratama', 'andi@ajucuti.local', '$2b$10$S5.oIXwp1nXTJ5lVvKGSauitrdZ3MWoismaI1rM5kXjnG1osR9Umq', 'user', 1, 'Web Developer', '081200000005', 12, true, '2026-11-21 15:21:54.697168+08', '2026-11-21 15:23:34.970119+08', 'andi', '2024-11-21', NULL, NULL);
INSERT INTO public.users VALUES (6, 'EMP-002', 'Dewi Lestari', 'dewi@ajucuti.local', '$2b$10$S5.oIXwp1nXTJ5lVvKGSauitrdZ3MWoismaI1rM5kXjnG1osR9Umq', 'user', 2, 'Staf Akuntansi', '081200000006', 12, true, '2026-11-21 15:21:54.697168+08', '2026-11-21 16:06:26.581316+08', 'dewi', '2026-05-21', NULL, NULL);
INSERT INTO public.users VALUES (1, 'ADM-001', 'Admin AjuCuti', 'admin@ajucuti.local', '$2b$10$S5.oIXwp1nXTJ5lVvKGSauitrdZ3MWoismaI1rM5kXjnG1osR9Umq', 'admin', 1, 'Administrator Sistem', '081200000001', 0, true, '2026-11-21 15:21:54.697168+08', '2026-11-21 22:40:59.135734+08', 'admin', '2023-11-21', NULL, NULL);
INSERT INTO public.users VALUES (7, 'EMP-007', 'Aida Dalili Fahimah', 'hrd1@ajucuti.local', '$2b$10$IuKUVTFEWNGuU87gZryTTOgyfTMmEtMCnLeEVUy3ycQa/xsz7WrZO', 'hrd', NULL, NULL, '081111111111', 0, true, '2026-11-21 21:55:35.349215+08', '2026-11-21 22:40:59.135734+08', 'Lily', '2026-11-21', 'usuuwuwuwuwu', NULL);
INSERT INTO public.users VALUES (2, 'HRD-001', 'Siti Rahmawati', 'hrd@ajucuti.local', '$2b$10$S5.oIXwp1nXTJ5lVvKGSauitrdZ3MWoismaI1rM5kXjnG1osR9Umq', 'hrd', 3, 'Manajer HRD', '08120099999', 0, true, '2026-11-21 15:21:54.697168+08', '2026-11-22 13:40:20.204012+08', 'hrd', '2023-11-21', NULL, NULL);


--
-- Name: blackout_periods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.blackout_periods_id_seq', 1, false);


--
-- Name: divisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.divisions_id_seq', 4, true);


--
-- Name: holidays_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.holidays_id_seq', 28, true);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leave_requests_id_seq', 13, true);


--
-- Name: leave_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leave_types_id_seq', 4, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 15, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 7, true);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: blackout_periods blackout_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blackout_periods
    ADD CONSTRAINT blackout_periods_pkey PRIMARY KEY (id);


--
-- Name: divisions divisions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.divisions
    ADD CONSTRAINT divisions_code_key UNIQUE (code);


--
-- Name: divisions divisions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.divisions
    ADD CONSTRAINT divisions_name_key UNIQUE (name);


--
-- Name: divisions divisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.divisions
    ADD CONSTRAINT divisions_pkey PRIMARY KEY (id);


--
-- Name: holidays holidays_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_holiday_date_key UNIQUE (holiday_date);


--
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_code_key UNIQUE (code);


--
-- Name: leave_types leave_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_name_key UNIQUE (name);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_code_key UNIQUE (employee_code);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: divisions_leader_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX divisions_leader_unique ON public.divisions USING btree (leader_id) WHERE (leader_id IS NOT NULL);


--
-- Name: idx_divisions_leader_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_divisions_leader_id ON public.divisions USING btree (leader_id);


--
-- Name: idx_leave_requests_leave_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_leave_type_id ON public.leave_requests USING btree (leave_type_id);


--
-- Name: idx_leave_requests_quota_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_quota_lookup ON public.leave_requests USING btree (user_id, start_date, status);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- Name: idx_leave_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_user_id ON public.leave_requests USING btree (user_id);


--
-- Name: idx_users_division_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_division_id ON public.users USING btree (division_id);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: divisions trg_divisions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_divisions_updated_at BEFORE UPDATE ON public.divisions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leave_requests trg_leave_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leave_types trg_leave_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_types_updated_at BEFORE UPDATE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: divisions fk_divisions_leader; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.divisions
    ADD CONSTRAINT fk_divisions_leader FOREIGN KEY (leader_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_handover_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_handover_user_id_fkey FOREIGN KEY (handover_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_hrd_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_hrd_id_fkey FOREIGN KEY (hrd_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE RESTRICT;


--
-- Name: leave_requests leave_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_division_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_division_id_fkey FOREIGN KEY (division_id) REFERENCES public.divisions(id) ON DELETE SET NULL;


--

