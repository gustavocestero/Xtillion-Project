"""Sanity tests for the pipeline. Run with: pytest -q"""

import pandas as pd
import pytest

import loaders
import matching


@pytest.fixture(scope="module")
def people_json():
    return loaders.load_people_json()


@pytest.fixture(scope="module")
def people_yaml():
    return loaders.load_people_yaml()


@pytest.fixture(scope="module")
def people(people_json, people_yaml):
    return matching.merge_people(people_json, people_yaml)


def test_people_json_row_count(people_json):
    assert len(people_json) == 933


def test_people_yaml_row_count(people_yaml):
    assert len(people_yaml) == 297


def test_merged_people_row_count(people):
    assert len(people) == 1002


def test_promo_match_rate(people):
    promos = loaders.load_promotions()
    promos = matching.link_promotions(promos, people)
    rate = promos["person_id"].notna().mean()
    assert rate == pytest.approx(1.0)


def test_txn_match_rate(people):
    txns = loaders.load_transactions()
    txns = matching.link_transactions(txns, people)
    rate = txns["person_id"].notna().mean()
    # spec says ~97.9% — allow a small tolerance
    assert rate >= 0.95


def test_transfers_load():
    transfers = loaders.load_transfers()
    assert len(transfers) == 614


def test_loaders_no_duplicate_ids(people_json, people_yaml):
    assert people_json["id"].is_unique
    assert people_yaml["id"].is_unique
