--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (165f042)
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    address text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    invoice_id character varying NOT NULL,
    description text NOT NULL,
    amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    customer_id character varying NOT NULL,
    invoice_number integer NOT NULL,
    date text NOT NULL,
    service text,
    amount numeric(10,2),
    is_paid boolean DEFAULT false NOT NULL,
    google_sheet_row_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    company_name text
);


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, user_id, name, email, phone, address, created_at) FROM stdin;
7f679338-8264-48ea-ac41-bbb266168989	4e9e640d-e53d-4eac-b1c3-055eaebc88cc	Acme Corporation	billing@acme.com	(555) 123-4567	123 Business St, Suite 100, New York, NY 10001	2025-11-08 00:40:27.915822
21865a1a-fddb-4dc2-9e18-031815107437	4e9e640d-e53d-4eac-b1c3-055eaebc88cc	Tech Solutions Inc	contact@techsolutions.com	(555) 234-5678	456 Innovation Drive, San Francisco, CA 94102	2025-11-08 00:45:45.941847
0b322d43-6f46-4b10-9aaf-f6ef1e90f2eb	afd9b456-aee4-4281-81e9-0e3b92895e16	LineItemTest-OjKaRr	lineitemtest@example.com	555-1234	123 Test Street	2025-11-08 16:56:00.13284
\.


--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoice_items (id, invoice_id, description, amount, created_at) FROM stdin;
9189d9cd-6fcb-467f-a193-2d8528dd7688	be3f371e-485e-4d82-9fee-fcf20966c3d5	Web Design Services	500.00	2025-11-08 16:58:07.26005
5d95e071-42ea-4608-9e99-ca57fdefd747	be3f371e-485e-4d82-9fee-fcf20966c3d5	SEO Optimization	300.00	2025-11-08 16:58:07.26005
3b97b750-c911-4b90-8e92-54df6ab79c9e	be3f371e-485e-4d82-9fee-fcf20966c3d5	Content Writing	200.00	2025-11-08 16:58:07.26005
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoices (id, user_id, customer_id, invoice_number, date, service, amount, is_paid, google_sheet_row_id, created_at, updated_at) FROM stdin;
e5e03d10-f5a2-4acf-a024-c4c8be4f44f6	4e9e640d-e53d-4eac-b1c3-055eaebc88cc	21865a1a-fddb-4dc2-9e18-031815107437	1001	2025-11-08	Monthly Maintenance Services	1500.00	f	Invoices!A2:F2	2025-11-08 00:47:13.692369	2025-11-08 00:47:36.218
62375660-6cc5-4ca3-aa54-bbc0ed6854ad	4e9e640d-e53d-4eac-b1c3-055eaebc88cc	21865a1a-fddb-4dc2-9e18-031815107437	1002	2025-11-08	medical services	1000.00	f	Invoices!A2:F2	2025-11-08 00:51:12.444925	2025-11-08 00:51:14.491
be3f371e-485e-4d82-9fee-fcf20966c3d5	afd9b456-aee4-4281-81e9-0e3b92895e16	0b322d43-6f46-4b10-9aaf-f6ef1e90f2eb	1001	2025-11-08	\N	\N	f	\N	2025-11-08 16:58:07.221771	2025-11-08 16:58:07.221771
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.session (sid, sess, expire) FROM stdin;
_2v9GZSagUn3C1_7XHQ1YIsZTieE5ypj	{"cookie":{"originalMaxAge":604800000,"expires":"2025-11-15T18:15:15.441Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"userId":"4e9e640d-e53d-4eac-b1c3-055eaebc88cc"}	2025-11-15 18:15:21
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, password, company_name) FROM stdin;
4e9e640d-e53d-4eac-b1c3-055eaebc88cc	admin	$2b$10$BmfiWPJANsQtlf8SWTSkgeomkLEB0yvg7Bikf8marxmij.hWlm/lK	Acme Corporation
afd9b456-aee4-4281-81e9-0e3b92895e16	testuser	$2b$10$MBJ/..udh7tH7bMFNra6ruOAAsYk0UL.xipKy0O15iPhy8k62CeFm	Test Company
\.


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: customers customers_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_invoice_id_invoices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

